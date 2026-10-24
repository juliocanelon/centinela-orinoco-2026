import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Acceso mínimo a la base que necesita la ingesta. Producción usa supabase-js;
 * la verificación local puede usar otra implementación (p. ej. PostgreSQL directo).
 */
export interface IngestionStore {
  /** Devuelve las filas existentes (solo `columns`) cuyo valor de `filterColumn` está en `values`. */
  selectWhereIn(table: string, columns: string[], filterColumn: string, values: (string | number)[]): Promise<Record<string, any>[]>;
  /** Inserta ignorando conflictos sobre `conflictColumns`; devuelve cuántas filas se insertaron. */
  insertIgnoringDuplicates(table: string, rows: Record<string, any>[], conflictColumns: string[]): Promise<number>;
  /** Actualiza las filas cuyo `keyColumn` coincide. */
  update(table: string, keyColumn: string, keyValue: string, values: Record<string, any>): Promise<void>;
  /** Conteo exacto de filas de una tabla. */
  count(table: string): Promise<number>;
  /** Inserción simple (sin control de duplicados), p. ej. el registro de una ejecución. */
  insert(table: string, row: Record<string, any>): Promise<void>;
  /** Últimas `limit` filas ordenadas por `orderColumn` descendente, con filtros de igualdad / mínimo opcionales. */
  selectLatest(
    table: string,
    columns: string[],
    orderColumn: string,
    limit: number,
    filters?: { eq?: Record<string, string | number | boolean>; gte?: [string, string | number]; notNull?: string }
  ): Promise<Record<string, any>[]>;
}

const WRITE_BATCH = 500;
const IN_FILTER_BATCH = 150;
/** La API de Supabase devuelve como máximo 1000 filas por petición (max_rows): se pagina. */
const READ_PAGE = 1000;

/** Lee todas las páginas de una consulta; `buildQuery` debe aplicar un orden estable. */
async function readAllPages(
  table: string,
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  limit = Number.POSITIVE_INFINITY
): Promise<Record<string, any>[]> {
  const rows: Record<string, any>[] = [];
  while (rows.length < limit) {
    const pageSize = Math.min(READ_PAGE, limit - rows.length);
    const { data, error } = await buildQuery(rows.length, rows.length + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data as Record<string, any>[]) || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export function createSupabaseStore(client: SupabaseClient): IngestionStore {
  return {
    async selectWhereIn(table, columns, filterColumn, values) {
      const unique = [...new Set(values)];
      const result: Record<string, any>[] = [];
      for (let i = 0; i < unique.length; i += IN_FILTER_BATCH) {
        const values = unique.slice(i, i + IN_FILTER_BATCH);
        result.push(...await readAllPages(table, (from, to) => {
          let query = client.from(table).select(columns.join(",")).in(filterColumn, values);
          // Orden por todas las columnas de la clave: paginación estable.
          for (const col of columns) query = query.order(col, { ascending: true });
          return query.range(from, to);
        }));
      }
      return result;
    },
    async insertIgnoringDuplicates(table, rows, conflictColumns) {
      let inserted = 0;
      for (let i = 0; i < rows.length; i += WRITE_BATCH) {
        const { data, error } = await client
          .from(table)
          .upsert(rows.slice(i, i + WRITE_BATCH), { onConflict: conflictColumns.join(","), ignoreDuplicates: true })
          .select(conflictColumns[0]);
        if (error) throw new Error(`${table}: ${error.message}`);
        inserted += data?.length || 0;
      }
      return inserted;
    },
    async update(table, keyColumn, keyValue, values) {
      const { error } = await client.from(table).update(values).eq(keyColumn, keyValue);
      if (error) throw new Error(`${table}: ${error.message}`);
    },
    async count(table) {
      const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
      if (error) throw new Error(`${table}: ${error.message}`);
      return count || 0;
    },
    async insert(table, row) {
      const { error } = await client.from(table).insert(row);
      if (error) throw new Error(`${table}: ${error.message}`);
    },
    async selectLatest(table, columns, orderColumn, limit, filters) {
      return readAllPages(table, (from, to) => {
        let query = client.from(table).select(columns.join(","));
        for (const [col, value] of Object.entries(filters?.eq || {})) query = query.eq(col, value);
        if (filters?.gte) query = query.gte(filters.gte[0], filters.gte[1]);
        if (filters?.notNull) query = query.not(filters.notNull, "is", null);
        // columns[0] es el identificador de la fila: desempate para paginar sin saltos.
        return query.order(orderColumn, { ascending: false }).order(columns[0], { ascending: true }).range(from, to);
      }, limit);
    },
  };
}

export interface InsertOutcome {
  received: number;
  inserted: number;
  skipped: number;
  /** Filas que no existían antes de la consulta y se enviaron a insertar. */
  sent: Record<string, any>[];
}

/**
 * Inserta solo las filas cuya clave natural no existe todavía.
 * 1) consulta las claves existentes del lote, 2) envía solo las nuevas,
 * 3) el índice único de la tabla rechaza cualquier duplicado restante.
 */
export async function insertOnlyNew(
  store: IngestionStore,
  table: string,
  rows: Record<string, any>[],
  options: {
    conflictColumns: string[];
    keyOf: (row: Record<string, any>) => string;
    /** Columna usada para acotar la consulta de existentes (debe formar parte de la clave). */
    prefilterColumn: string;
  }
): Promise<InsertOutcome> {
  // Filas repetidas dentro del mismo lote (p. ej. el mismo foco en dos sensores no ocurre, pero sí en reintentos).
  const byKey = new Map<string, Record<string, any>>();
  for (const row of rows) byKey.set(options.keyOf(row), row);
  const uniqueRows = [...byKey.values()];

  const existing = await store.selectWhereIn(
    table,
    options.conflictColumns,
    options.prefilterColumn,
    uniqueRows.map(r => r[options.prefilterColumn])
  );
  const existingKeys = new Set(existing.map(options.keyOf));
  const fresh = uniqueRows.filter(r => !existingKeys.has(options.keyOf(r)));

  const inserted = fresh.length > 0 ? await store.insertIgnoringDuplicates(table, fresh, options.conflictColumns) : 0;
  return { received: rows.length, inserted, skipped: rows.length - inserted, sent: fresh };
}

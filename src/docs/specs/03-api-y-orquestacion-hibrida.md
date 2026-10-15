# API y orquestacion hibrida

## Principios

- Toda escritura poliglota pasa por el backend.
- Los endpoints validan el cuerpo antes de tocar cualquier motor.
- Cada operacion mutable requiere `Idempotency-Key`.
- Cada respuesta incluye `correlationId` y un estado comprensible.
- Los errores transitorios no se presentan como exito local.

## Endpoint principal

### `POST /api/community-reports/:id/elevate-incident`

Cabeceras:

```http
Content-Type: application/json
Idempotency-Key: <uuid-generado-por-el-cliente>
```

Cuerpo:

```json
{
  "assignedUnit": "Comando de Guarderia Ambiental / Fluvial",
  "operatorId": "optional-operator-id",
  "notes": "optional"
}
```

Respuesta exitosa, HTTP `201`:

```json
{
  "success": true,
  "operationStatus": "COMPLETED",
  "operationId": "uuid",
  "correlationId": "uuid",
  "incident": {
    "id": "uuid",
    "code": "ALERTA-DEN-2026-001",
    "sourceReportId": "uuid",
    "status": "IN_PROGRESS",
    "evidenceCount": 2
  }
}
```

Respuesta repetida con la misma clave y cuerpo, HTTP `200`: devuelve el `response_snapshot` previo y `replayed: true`.

Errores:

- `400 VALIDATION_ERROR`: cuerpo o identificador invalido.
- `404 REPORT_NOT_FOUND`: denuncia inexistente.
- `409 IDEMPOTENCY_CONFLICT`: misma clave con contenido diferente.
- `409 REPORT_ALREADY_ELEVATED`: denuncia asociada a otro incidente.
- `422 REPORT_NOT_ELIGIBLE`: estado de denuncia no elevable.
- `503 HYBRID_WRITE_UNAVAILABLE`: fallo transitorio, operacion no confirmada.
- `500 HYBRID_WRITE_FAILED`: fallo final o compensacion incompleta.

## Algoritmo de la saga

```text
1. Validar entrada e Idempotency-Key.
2. Calcular request_hash canonico.
3. Buscar o crear integration_operation PENDING.
4. Si existe COMPLETED con el mismo hash, reproducir respuesta.
5. Abrir transaccion PostgreSQL.
6. Bloquear la denuncia con SELECT ... FOR UPDATE.
7. Validar que puede elevarse.
8. Crear incidente con UUID generado por el backend.
9. Actualizar denuncia con linked_incident_id y OPERATIVO_ENVIADO.
10. Marcar operacion POSTGRES_COMMITTED.
11. Confirmar transaccion PostgreSQL.
12. Insertar documento en MongoDB mediante upsert con $setOnInsert.
13. Marcar operacion COMPLETED y guardar response_snapshot.
14. Responder exito.
```

## Compensacion

Si el paso de MongoDB falla despues del commit PostgreSQL:

1. Clasificar el fallo como transitorio o permanente.
2. Reintentar solamente errores transitorios hasta `HYBRID_WRITE_MAX_RETRIES`.
3. Si se agotan los reintentos, marcar `COMPENSATING`.
4. En una nueva transaccion PostgreSQL:
   - cambiar el incidente a `CANCELLED`;
   - registrar `cancelled_at` y una razon tecnica sanitizada;
   - retirar `linked_incident_id` de la denuncia;
   - devolver la denuncia a `CONFIRMADA_EN_TERRENO`;
   - marcar la operacion `COMPENSATED`.
5. Responder error, nunca exito parcial.

Se prefiere cancelacion logica sobre borrado fisico para conservar trazabilidad. Si el equipo decide borrado fisico, la migracion debe garantizar que no existan dependencias antes de eliminar.

Si falla la compensacion, la operacion queda `FAILED_FINAL`, se emite un log de severidad alta y debe aparecer en reconciliacion.

## Idempotencia

- La clave llega desde el cliente y debe ser UUID.
- El `request_hash` se calcula sobre metodo, ruta, identificador y JSON canonico.
- Una restriccion unica en `integration_operations.idempotency_key` resuelve condiciones de carrera.
- MongoDB usa indice unico en `incident_id` y escritura `upsert`.
- La repeticion nunca incrementa `evidence_count` ni crea un codigo nuevo.

## Estados permitidos de la denuncia

Elevables:

- `CONFIRMADA_EN_TERRENO`
- `PENDIENTE_VALIDACION`, solamente si la regla actual del producto permite elevacion directa; por defecto no se permite.

No elevables:

- `OPERATIVO_ENVIADO`
- `DESESTIMADA`

## Endpoint de lectura del incidente enriquecido

### `GET /api/incidents/:id/details`

Proceso:

1. Leer incidente de PostgreSQL.
2. Leer documento MongoDB por `incident_id`.
3. Unir la respuesta en el servicio, sin copiar permanentemente un modelo al otro.

HTTP `200` aun si el documento no existe, pero debe incluir:

```json
{
  "incident": {},
  "evidence": null,
  "dataIntegrity": "MISSING_DOCUMENT"
}
```

Esto permite diagnosticar inconsistencias sin ocultarlas.

## Endpoint del reporte consolidado

### `GET /api/reports/incidents-summary?from=<ISO>&to=<ISO>&limit=1000&cursor=<token>`

Validaciones:

- `from` y `to` son obligatorios y `from <= to`.
- El rango maximo inicial es 366 dias.
- `limit` maximo: 1000.
- La paginacion usa cursor estable, no desplazamiento para conjuntos grandes.

Respuesta minima:

```json
{
  "period": { "from": "ISODate", "to": "ISODate" },
  "totals": {
    "incidents": 0,
    "withEvidence": 0,
    "missingEvidence": 0
  },
  "bySeverity": [],
  "byCategory": [],
  "byLocation": [],
  "byEvidenceType": [],
  "items": [],
  "nextCursor": null
}
```

## Endpoint de reconciliacion

### `GET /api/admin/persistence/reconciliation?from=<ISO>&to=<ISO>&limit=500`

Solo diagnostica. Respuesta:

```json
{
  "postgresWithoutMongo": ["incident-uuid"],
  "mongoWithoutPostgres": ["incident-uuid"],
  "staleOperations": ["operation-uuid"],
  "checkedAt": "ISODate"
}
```

Una futura accion de reparacion debe usar un endpoint separado, autenticado y auditable.

## Interfaces internas sugeridas

```typescript
interface IncidentRepository {
  createFromCommunityReport(input: CreateIncidentInput): Promise<Incident>;
  cancel(id: string, reason: string): Promise<void>;
  findById(id: string): Promise<Incident | null>;
}

interface EvidenceRepository {
  createIfAbsent(document: IncidentEvidenceDocument): Promise<void>;
  findByIncidentId(id: string): Promise<IncidentEvidenceDocument | null>;
  findByIncidentIds(ids: string[]): Promise<IncidentEvidenceDocument[]>;
}

interface IntegrationOperationRepository {
  begin(input: BeginOperationInput): Promise<IntegrationOperation>;
  transition(id: string, expected: string, next: string): Promise<void>;
  complete(id: string, response: unknown): Promise<void>;
  fail(id: string, error: SanitizedError): Promise<void>;
}
```

## Observabilidad

Cada paso registra JSON estructurado con:

- `timestamp`
- `level`
- `correlation_id`
- `operation_id`
- `incident_id`, cuando exista
- `step`
- `duration_ms`
- `outcome`
- `error_code`, cuando corresponda

Nunca registrar cuerpo completo, contactos, claves ni URI de conexion.


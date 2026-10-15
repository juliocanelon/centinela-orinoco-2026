import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HybridCommunityMedia, HybridCommunityReport } from "./hybridIncidentService";

export interface CommunityReportMediaInput {
  id?: string;
  type?: "image" | "video";
  name?: string;
  url?: string;
  sizeMb?: number;
  thumbnailUrl?: string;
  storagePath?: string;
}

export interface CommunityReportRecord {
  id: string;
  code: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  locationName: string;
  communityName?: string;
  description: string;
  isAnonymous: boolean;
  reporterName?: string;
  reporterContact?: string;
  media: CommunityReportMediaInput[];
  timestamp: string;
  verifiedBy?: string;
  linkedIncidentId?: string;
  upvotesCount?: number;
}

export class CommunityReportPersistenceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CommunityReportPersistenceError";
  }
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_CODE_ATTEMPTS = 5;

export function evidenceBucket(): string {
  return process.env.SUPABASE_EVIDENCE_BUCKET?.trim() || "community-evidence";
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function safeFileName(name: string): string {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(0, 80) || "evidencia";
}

function decodeDataUrl(url: string): { contentType: string; bytes: Buffer } | null {
  const match = url.match(/^data:([^;,]+)((?:;[^,]*)*),(.*)$/s);
  if (!match) return null;

  const [, contentType, parameters, payload] = match;
  // Las muestras simuladas ("data:video/mp4;simulation=...") no contienen binario real.
  if (!payload) return null;

  const isBase64 = parameters.split(";").includes("base64");
  try {
    const bytes = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");

    return bytes.length > 0 ? { contentType, bytes } : null;
  } catch {
    return null;
  }
}

let bucketReady: Promise<void> | null = null;

function ensureEvidenceBucket(supabase: SupabaseClient): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { error } = await supabase.storage.getBucket(evidenceBucket());
      if (!error) return;

      const { error: createError } = await supabase.storage.createBucket(evidenceBucket(), {
        public: false,
      });
      if (createError && !/already exists/i.test(createError.message)) {
        throw new CommunityReportPersistenceError(
          "STORAGE_BUCKET_UNAVAILABLE",
          `No se pudo preparar el bucket de evidencias: ${createError.message}`,
        );
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }

  return bucketReady;
}

function reportFolder(reportId: string): string {
  return `reports/${reportId}`;
}

/**
 * Sube a Supabase Storage la evidencia que llega embebida como data URL.
 * Los nombres de objeto siguen el patron `<mediaId>__<nombre>` para poder
 * reconstruir la evidencia mas tarde sin una columna adicional en PostgreSQL.
 */
async function uploadEvidence(
  supabase: SupabaseClient,
  reportId: string,
  media: CommunityReportMediaInput[],
): Promise<CommunityReportMediaInput[]> {
  const uploadable = media.filter((item) => item.url?.startsWith("data:"));
  if (uploadable.length === 0) return media;

  await ensureEvidenceBucket(supabase);

  return Promise.all(
    media.map(async (item) => {
      const decoded = item.url ? decodeDataUrl(item.url) : null;
      if (!decoded) {
        if (item.url?.startsWith("data:") || item.url?.startsWith("blob:")) {
          console.warn(
            `[Community Report] Evidencia ${item.id ?? "sin-id"} sin binario utilizable; no se sube a Storage.`,
          );
        }
        return item;
      }

      const mediaId = (item.id || randomUUID()).replace(/[^\w-]/g, "_");
      const objectPath = `${reportFolder(reportId)}/${mediaId}__${safeFileName(item.name || "evidencia")}`;
      const { error } = await supabase.storage
        .from(evidenceBucket())
        .upload(objectPath, decoded.bytes, { contentType: decoded.contentType, upsert: true });

      if (error) {
        throw new CommunityReportPersistenceError(
          "STORAGE_UPLOAD_FAILED",
          `No se pudo subir la evidencia "${item.name}": ${error.message}`,
        );
      }

      return { ...item, storagePath: objectPath };
    }),
  );
}

function reportCodePrefix(): string {
  return `DEN-${new Date().getFullYear()}-`;
}

/** Mayor correlativo entre los codigos dados que siguen el patron DEN-<año>-<n>. */
export function maxReportSequence(codes: Iterable<string>): number {
  const prefix = reportCodePrefix();
  let max = 0;
  for (const code of codes) {
    if (!code?.startsWith(prefix)) continue;
    const sequence = Number(code.slice(prefix.length));
    if (Number.isInteger(sequence) && sequence > max) max = sequence;
  }
  return max;
}

export function formatReportCode(sequence: number): string {
  return `${reportCodePrefix()}${String(sequence).padStart(3, "0")}`;
}

async function nextReportCode(
  supabase: SupabaseClient,
  reservedCodes: string[],
  attempt: number,
): Promise<string> {
  const { data, error } = await supabase
    .from("community_reports")
    .select("code")
    .like("code", `${reportCodePrefix()}%`);

  if (error) {
    throw new CommunityReportPersistenceError(
      "SUPABASE_READ_FAILED",
      `No se pudo calcular el codigo de la denuncia: ${error.message}`,
    );
  }

  const persistedCodes = (data ?? []).map((row: { code: string }) => row.code);
  return formatReportCode(maxReportSequence([...persistedCodes, ...reservedCodes]) + 1 + attempt);
}

export async function createCommunityReport(
  supabase: SupabaseClient,
  report: Omit<CommunityReportRecord, "id" | "code">,
  reservedCodes: string[] = [],
): Promise<CommunityReportRecord> {
  const id = randomUUID();
  const media = await uploadEvidence(supabase, id, report.media);
  const evidenceCount = media.filter((item) => item.storagePath).length;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = await nextReportCode(supabase, reservedCodes, attempt);
    const { error } = await supabase.from("community_reports").insert({
      id,
      code,
      title: report.title,
      category: report.category,
      severity: report.severity,
      status: report.status,
      latitude: report.latitude,
      longitude: report.longitude,
      location_name: report.locationName,
      community_name: report.communityName ?? null,
      description: report.description,
      is_anonymous: report.isAnonymous,
      reporter_name: report.isAnonymous ? null : report.reporterName ?? null,
      reporter_contact: report.isAnonymous ? null : report.reporterContact ?? null,
      evidence_count: evidenceCount,
      created_at: report.timestamp,
    });

    if (!error) {
      return { ...report, id, code, media };
    }

    // 23505 = codigo duplicado por una insercion concurrente; se reintenta con el siguiente.
    if (error.code === "23505" && /code/i.test(`${error.message} ${error.details ?? ""}`)) {
      continue;
    }

    throw new CommunityReportPersistenceError(
      "SUPABASE_INSERT_FAILED",
      `Supabase rechazo la denuncia (${error.code ?? "sin codigo"}): ${error.message}`,
    );
  }

  throw new CommunityReportPersistenceError(
    "REPORT_CODE_CONFLICT",
    "No se pudo asignar un codigo unico a la denuncia.",
  );
}

export async function updateCommunityReportStatus(
  supabase: SupabaseClient,
  id: string,
  status: string,
  verifiedBy?: string,
): Promise<void> {
  const changes: Record<string, unknown> = { status };
  if (verifiedBy) changes.verified_by = verifiedBy;

  const { error } = await supabase.from("community_reports").update(changes).eq("id", id);
  if (error) {
    throw new CommunityReportPersistenceError(
      "SUPABASE_UPDATE_FAILED",
      `No se pudo actualizar el estado de la denuncia: ${error.message}`,
    );
  }
}

async function listEvidence(
  supabase: SupabaseClient,
  reportId: string,
): Promise<HybridCommunityMedia[]> {
  const { data, error } = await supabase.storage
    .from(evidenceBucket())
    .list(reportFolder(reportId), { limit: 100 });

  if (error || !data) return [];

  return data
    .filter((object) => object.id)
    .map((object) => {
      const [mediaId, ...rest] = object.name.split("__");
      const contentType = String(object.metadata?.mimetype ?? "");
      return {
        id: mediaId,
        type: contentType.startsWith("video/") ? "video" : "image",
        name: rest.join("__") || object.name,
        url: `${reportFolder(reportId)}/${object.name}`,
        sizeMb: Number(object.metadata?.size ?? 0) / (1024 * 1024),
        contentType: contentType || undefined,
      };
    });
}

interface CommunityReportRow {
  id: string;
  code: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  location_name: string;
  community_name: string | null;
  description: string;
  is_anonymous: boolean;
  reporter_name: string | null;
  reporter_contact: string | null;
  evidence_count: number;
  verified_by: string | null;
  linked_incident_id: string | null;
  created_at: string;
}

/** Carga la denuncia desde PostgreSQL (fuente de verdad) junto con su evidencia en Storage. */
export async function loadReportForElevation(
  supabase: SupabaseClient,
  id: string,
): Promise<HybridCommunityReport | null> {
  const { data, error } = await supabase
    .from("community_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle<CommunityReportRow>();

  if (error) {
    throw new CommunityReportPersistenceError(
      "SUPABASE_READ_FAILED",
      `No se pudo leer la denuncia: ${error.message}`,
    );
  }
  if (!data) return null;

  return {
    id: data.id,
    code: data.code,
    title: data.title,
    category: data.category,
    severity: data.severity,
    status: data.status,
    latitude: data.latitude,
    longitude: data.longitude,
    locationName: data.location_name,
    communityName: data.community_name ?? undefined,
    description: data.description,
    isAnonymous: data.is_anonymous,
    media: data.evidence_count > 0 ? await listEvidence(supabase, data.id) : [],
  };
}

/** Lista las denuncias persistidas, con URLs firmadas temporales para visualizar la evidencia. */
export async function listCommunityReports(
  supabase: SupabaseClient,
  limit = 200,
): Promise<CommunityReportRecord[]> {
  const { data, error } = await supabase
    .from("community_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<CommunityReportRow[]>();

  if (error) {
    throw new CommunityReportPersistenceError(
      "SUPABASE_READ_FAILED",
      `No se pudieron listar las denuncias: ${error.message}`,
    );
  }

  return Promise.all(
    (data ?? []).map(async (row) => {
      let media: CommunityReportMediaInput[] = [];

      if (row.evidence_count > 0) {
        const evidence = await listEvidence(supabase, row.id);
        const { data: signed } = await supabase.storage
          .from(evidenceBucket())
          .createSignedUrls(evidence.map((item) => item.url), SIGNED_URL_TTL_SECONDS);

        media = evidence.map((item, index) => ({
          id: item.id,
          type: item.type,
          name: item.name,
          sizeMb: Number((item.sizeMb ?? 0).toFixed(2)),
          storagePath: item.url,
          url: signed?.[index]?.signedUrl ?? "",
        }));
      }

      return {
        id: row.id,
        code: row.code,
        title: row.title,
        category: row.category,
        severity: row.severity,
        status: row.status,
        latitude: row.latitude,
        longitude: row.longitude,
        locationName: row.location_name,
        communityName: row.community_name ?? undefined,
        description: row.description,
        isAnonymous: row.is_anonymous,
        reporterName: row.reporter_name ?? undefined,
        reporterContact: row.reporter_contact ?? undefined,
        media,
        timestamp: row.created_at,
        verifiedBy: row.verified_by ?? undefined,
        linkedIncidentId: row.linked_incident_id ?? undefined,
      };
    }),
  );
}

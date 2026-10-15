import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, Document } from "mongodb";
import { getMongoDatabase } from "../db/mongoClient";
import { getSupabaseServerClient } from "../satelliteScheduler";

export interface HybridCommunityMedia {
  id: string;
  type: "image" | "video";
  name: string;
  url: string;
  sizeMb?: number;
  thumbnailUrl?: string;
}

export interface HybridCommunityReport {
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
  media: HybridCommunityMedia[];
}

export interface ElevateCommunityReportInput {
  report: HybridCommunityReport;
  idempotencyKey: string;
  assignedUnit?: string;
  reportedBy?: string;
}

export interface HybridElevationResult {
  success: boolean;
  replayed?: boolean;
  operationId?: string;
  operationStatus?: string;
  errorCode?: string;
  incident?: Record<string, unknown>;
}

interface StartRpcResult {
  success: boolean;
  operation_id?: string;
  operation_status?: string;
  error_code?: string;
  incident?: Record<string, unknown>;
  replayed?: boolean;
}

function requireSupabase(): SupabaseClient {
  const client = getSupabaseServerClient();

  if (!client) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  return client;
}

function canonicalRequest(input: ElevateCommunityReportInput): string {
  return JSON.stringify({
    reportId: input.report.id,
    assignedUnit: input.assignedUnit ?? null,
    reportedBy: input.reportedBy ?? null,
  });
}

function requestHash(input: ElevateCommunityReportInput): string {
  return createHash("sha256").update(canonicalRequest(input)).digest("hex");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function buildEvidenceDocument(
  input: ElevateCommunityReportInput,
  incident: Record<string, unknown>,
  correlationId: string,
): Document {
  const report = input.report;
  const now = new Date();

  const evidence = report.media.map((media) => {
    if (media.url.startsWith("data:") || media.url.startsWith("blob:")) {
      throw new Error(
        "EVIDENCE_REQUIRES_STORAGE_REFERENCE: la evidencia debe estar en Supabase Storage antes de elevar el incidente.",
      );
    }

    return {
      evidence_id: media.id,
      type: media.type,
      storage: {
        provider: "supabase-storage",
        object_path: media.url,
        content_type: media.type === "video" ? "video/*" : "image/*",
        size_bytes: Math.round((media.sizeMb ?? 0) * 1024 * 1024),
      },
      tags: [report.category.toLowerCase()],
    };
  });

  return {
    incident_id: incident.id,
    source_report_id: report.id,
    schema_version: 1,
    created_at: now,
    updated_at: now,
    evidence,
    community_report: {
      title: report.title,
      community_name: report.communityName,
      is_anonymous: report.isAnonymous,
    },
    audit: {
      created_by: input.reportedBy ?? "Sistema Centinela",
      correlation_id: correlationId,
    },
  };
}

function collectionName(): string {
  return (
    process.env.MONGODB_INCIDENT_EVIDENCE_COLLECTION?.trim() ||
    "incident_evidence"
  );
}

function safeErrorSummary(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Fallo no especificado durante la persistencia documental.";
  }

  if (error.message.startsWith("EVIDENCE_REQUIRES_STORAGE_REFERENCE")) {
    return "La evidencia debe referenciar un objeto de Supabase Storage.";
  }

  if (error.message.includes("MongoDB")) {
    return "MongoDB no disponible durante la persistencia documental.";
  }

  return "Fallo controlado durante la persistencia documental.";
}

async function callRpc<T>(
  client: SupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, parameters);

  if (error) {
    const safeCode = typeof error.code === "string"
      ? error.code.replace(/[^A-Z0-9_]/gi, "_")
      : "UNKNOWN";
    const errorText = `${error.message ?? ""} ${error.details ?? ""}`;
    const constraintMatch = errorText.match(/constraint "([^"]+)"/i);
    const safeConstraint = constraintMatch?.[1]
      ? constraintMatch[1].replace(/[^A-Z0-9_]/gi, "_")
      : "UNKNOWN_CONSTRAINT";
    console.error(
      `[Supabase RPC ${name}] code=${safeCode} constraint=${safeConstraint}`,
    );
    throw new Error(
      `SUPABASE_RPC_${name.toUpperCase()}_${safeCode}_${safeConstraint}`,
    );
  }

  return data as T;
}

export async function elevateCommunityReport(
  input: ElevateCommunityReportInput,
): Promise<HybridElevationResult> {
  if (!isUuid(input.report.id)) {
    return {
      success: false,
      errorCode: "REPORT_ID_MUST_BE_UUID",
    };
  }

  const supabase = requireSupabase();
  const hash = requestHash(input);
  const correlationId = input.idempotencyKey;
  const started = await callRpc<StartRpcResult>(
    supabase,
    "start_hybrid_incident_elevation",
    {
      p_source_report_id: input.report.id,
      p_idempotency_key: input.idempotencyKey,
      p_request_hash: hash,
      p_assigned_unit: input.assignedUnit ?? null,
      p_reported_by: input.reportedBy ?? "Sistema Centinela",
    },
  );

  if (!started.success || !started.operation_id || !started.incident) {
    return {
      success: false,
      replayed: started.replayed,
      operationId: started.operation_id,
      operationStatus: started.operation_status,
      errorCode: started.error_code ?? "HYBRID_START_FAILED",
    };
  }

  if (started.replayed && started.operation_status === "COMPLETED") {
    return {
      success: true,
      replayed: true,
      operationId: started.operation_id,
      operationStatus: started.operation_status,
      incident: started.incident,
    };
  }

  try {
    const database = await getMongoDatabase();
    const collection: Collection = database.collection(collectionName());
    const document = buildEvidenceDocument(
      input,
      started.incident,
      correlationId,
    );

    await collection.updateOne(
      { incident_id: started.incident.id },
      {
        $setOnInsert: document,
      },
      { upsert: true },
    );

    const completed = await callRpc<HybridElevationResult>(
      supabase,
      "complete_hybrid_incident_operation",
      {
        p_operation_id: started.operation_id,
        p_response_snapshot: {
          success: true,
          operation_id: started.operation_id,
          operation_status: "COMPLETED",
          incident: started.incident,
        },
      },
    );

    return {
      ...completed,
      operationId: started.operation_id,
      operationStatus: completed.operationStatus ?? "COMPLETED",
      incident: started.incident,
    };
  } catch (error) {
    await callRpc(supabase, "compensate_hybrid_incident_operation", {
      p_operation_id: started.operation_id,
      p_reason: safeErrorSummary(error),
    }).catch(() => undefined);

    return {
      success: false,
      operationId: started.operation_id,
      operationStatus: "COMPENSATED",
      errorCode: "MONGODB_WRITE_FAILED",
    };
  }
}


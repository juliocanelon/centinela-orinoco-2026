import { randomUUID } from "node:crypto";
import { MongoServerError, ObjectId } from "mongodb";
import {
  closeMongoConnection,
  getMongoDatabase,
} from "../db/mongoClient";

const DEFAULT_COLLECTION = "incident_evidence";

async function verifyMongoPersistence(): Promise<void> {
  const database = await getMongoDatabase();
  const collectionName =
    process.env.MONGODB_INCIDENT_EVIDENCE_COLLECTION?.trim() ||
    DEFAULT_COLLECTION;
  const collection = database.collection(collectionName);
  const correlationId = randomUUID();
  const incidentId = randomUUID();
  const sourceReportId = randomUUID();
  const now = new Date();

  const indexes = await collection.indexes();
  const indexNames = new Set(indexes.map((index) => index.name));
  const requiredIndexes = [
    "incident_id_unique",
    "source_report_id_unique",
    "created_at_desc",
    "evidence_type_created_at",
  ];
  const missingIndexes = requiredIndexes.filter(
    (indexName) => !indexNames.has(indexName),
  );

  if (missingIndexes.length > 0) {
    throw new Error(`Faltan indices requeridos: ${missingIndexes.join(", ")}.`);
  }

  console.log("[MongoDB] Indices requeridos verificados.");

  try {
    let invalidDocumentRejected = false;

    try {
      await collection.insertOne({
        incident_id: randomUUID(),
        audit: { correlation_id: correlationId },
      });
    } catch (error) {
      invalidDocumentRejected =
        error instanceof MongoServerError && error.code === 121;
    }

    if (!invalidDocumentRejected) {
      throw new Error("El validador no rechazo el documento incompleto.");
    }

    console.log("[MongoDB] Documento invalido rechazado por el validador.");

    const validDocument = {
      incident_id: incidentId,
      source_report_id: sourceReportId,
      schema_version: 1,
      created_at: now,
      updated_at: now,
      evidence: [
        {
          evidence_id: randomUUID(),
          type: "image",
          storage: {
            provider: "supabase-storage",
            bucket: "community-evidence",
            object_path: `verification/${correlationId}/evidence.jpg`,
            content_type: "image/jpeg",
            size_bytes: 1024,
          },
          tags: ["verification"],
        },
      ],
      audit: {
        created_by: "mongo-verification-script",
        correlation_id: correlationId,
      },
    };

    await collection.insertOne(validDocument);
    console.log("[MongoDB] Documento valido insertado.");

    let duplicateRejected = false;

    try {
      await collection.insertOne({
        ...validDocument,
        _id: new ObjectId(),
        source_report_id: randomUUID(),
        audit: {
          ...validDocument.audit,
          correlation_id: correlationId,
        },
      });
    } catch (error) {
      duplicateRejected =
        error instanceof MongoServerError && error.code === 11000;
    }

    if (!duplicateRejected) {
      throw new Error("El indice unico no rechazo el incidente duplicado.");
    }

    console.log("[MongoDB] Incidente duplicado rechazado por indice unico.");
  } finally {
    const cleanup = await collection.deleteMany({
      "audit.correlation_id": correlationId,
    });
    console.log(
      `[MongoDB] Limpieza acotada completada: ${cleanup.deletedCount} documento(s).`,
    );
  }
}

async function main(): Promise<void> {
  try {
    await verifyMongoPersistence();
    console.log("[MongoDB] Verificacion completada correctamente.");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo verificar la configuracion MongoDB.";

    console.error(`[MongoDB] ${message}`);
    process.exitCode = 1;
  } finally {
    await closeMongoConnection();
  }
}

void main();


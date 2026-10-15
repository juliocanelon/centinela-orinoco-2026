import type { Document } from "mongodb";
import {
  closeMongoConnection,
  getMongoDatabase,
} from "../db/mongoClient";

const DEFAULT_COLLECTION = "incident_evidence";

const incidentEvidenceValidator: Document = {
  $jsonSchema: {
    bsonType: "object",
    title: "IncidentEvidenceDocument",
    required: [
      "incident_id",
      "source_report_id",
      "schema_version",
      "created_at",
      "updated_at",
      "evidence",
      "audit",
    ],
    additionalProperties: true,
    properties: {
      incident_id: {
        bsonType: "string",
        minLength: 1,
        description: "UUID compartido con PostgreSQL.",
      },
      source_report_id: {
        bsonType: "string",
        minLength: 1,
        description: "UUID de la denuncia comunitaria de origen.",
      },
      schema_version: {
        bsonType: "int",
        minimum: 1,
      },
      created_at: { bsonType: "date" },
      updated_at: { bsonType: "date" },
      evidence: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["evidence_id", "type", "storage"],
          additionalProperties: true,
          properties: {
            evidence_id: { bsonType: "string", minLength: 1 },
            type: {
              enum: ["image", "video", "document", "audio", "other"],
            },
            storage: {
              bsonType: "object",
              required: ["provider", "object_path"],
              additionalProperties: true,
              properties: {
                provider: { enum: ["supabase-storage"] },
                bucket: { bsonType: "string" },
                object_path: {
                  bsonType: "string",
                  minLength: 1,
                  pattern: "^(?!data:).+",
                  description: "Ruta de objeto; nunca contenido base64.",
                },
                content_type: { bsonType: "string" },
                size_bytes: { bsonType: ["int", "long"], minimum: 0 },
                sha256: { bsonType: "string" },
              },
            },
            capture: {
              bsonType: "object",
              additionalProperties: true,
              properties: {
                captured_at: { bsonType: "date" },
                device: { bsonType: "string" },
                latitude: { bsonType: ["double", "int", "long", "decimal"] },
                longitude: { bsonType: ["double", "int", "long", "decimal"] },
              },
            },
            tags: {
              bsonType: "array",
              items: { bsonType: "string" },
            },
          },
        },
      },
      satellite_analysis: {
        bsonType: "object",
        additionalProperties: true,
      },
      ai_enrichments: {
        bsonType: "array",
        items: { bsonType: "object" },
      },
      audit: {
        bsonType: "object",
        required: ["created_by", "correlation_id"],
        additionalProperties: true,
        properties: {
          created_by: { bsonType: "string", minLength: 1 },
          correlation_id: { bsonType: "string", minLength: 1 },
        },
      },
    },
  },
};

async function ensureCollection(): Promise<void> {
  const database = await getMongoDatabase();
  const collectionName =
    process.env.MONGODB_INCIDENT_EVIDENCE_COLLECTION?.trim() ||
    DEFAULT_COLLECTION;
  const exists = await database
    .listCollections({ name: collectionName }, { nameOnly: true })
    .hasNext();

  if (exists) {
    await database.command({
      collMod: collectionName,
      validator: incidentEvidenceValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
    console.log(`[MongoDB] Validador actualizado: ${collectionName}.`);
  } else {
    await database.createCollection(collectionName, {
      validator: incidentEvidenceValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
    console.log(`[MongoDB] Coleccion creada: ${collectionName}.`);
  }

  const collection = database.collection(collectionName);
  const indexNames = await collection.createIndexes([
    {
      key: { incident_id: 1 },
      name: "incident_id_unique",
      unique: true,
    },
    {
      key: { source_report_id: 1 },
      name: "source_report_id_unique",
      unique: true,
    },
    {
      key: { created_at: -1 },
      name: "created_at_desc",
    },
    {
      key: { "evidence.type": 1, created_at: -1 },
      name: "evidence_type_created_at",
    },
  ]);

  console.log(`[MongoDB] Indices verificados: ${indexNames.join(", ")}.`);
}

async function main(): Promise<void> {
  try {
    await ensureCollection();
    console.log("[MongoDB] Inicializacion completada correctamente.");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo inicializar MongoDB.";

    console.error(`[MongoDB] ${message}`);
    process.exitCode = 1;
  } finally {
    await closeMongoConnection();
  }
}

void main();


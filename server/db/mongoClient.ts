import dotenv from "dotenv";
import {
  Db,
  MongoClient,
  ServerApiVersion,
  type MongoClientOptions,
} from "mongodb";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const DEFAULT_DATABASE = "centinela_orinoco";
const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 15_000;

let mongoClient: MongoClient | null = null;
let mongoDatabase: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

export interface MongoHealthStatus {
  connected: boolean;
  database: string;
}

export type MongoConnectionFailure =
  | "AUTHENTICATION"
  | "DNS"
  | "TLS"
  | "NETWORK_ACCESS"
  | "TIMEOUT"
  | "CLUSTER_UNAVAILABLE"
  | "UNKNOWN";

export class MongoConnectionError extends Error {
  constructor(public readonly category: MongoConnectionFailure) {
    super(
      `No se pudo conectar con MongoDB. Categoria de diagnostico: ${category}.`,
    );
    this.name = "MongoConnectionError";
  }
}

function collectSafeErrorSignals(error: unknown): string {
  const messages: string[] = [];
  const visited = new Set<unknown>();

  function visit(value: unknown, depth: number): void {
    if (!value || depth > 4 || visited.has(value)) {
      return;
    }

    visited.add(value);

    if (value instanceof Error) {
      messages.push(value.name, value.message);
    }

    if (typeof value !== "object") {
      return;
    }

    const record = value as Record<string, unknown>;
    for (const key of ["cause", "reason", "error", "code", "codeName"]) {
      visit(record[key], depth + 1);
    }

    const servers = record.servers;
    if (servers instanceof Map) {
      for (const server of servers.values()) {
        visit(server, depth + 1);
      }
    }
  }

  visit(error, 0);
  return messages.join(" ").toLowerCase();
}

function classifyConnectionFailure(error: unknown): MongoConnectionFailure {
  const signals = collectSafeErrorSignals(error);

  if (/auth|credential|password|scram|bad auth/.test(signals)) {
    return "AUTHENTICATION";
  }
  if (/enotfound|dns|querysrv|querytxt/.test(signals)) {
    return "DNS";
  }
  if (/tls|ssl|certificate/.test(signals)) {
    return "TLS";
  }
  if (/allowlist|whitelist|econnrefused|econnreset|network/.test(signals)) {
    return "NETWORK_ACCESS";
  }
  if (/timeout|timed out|etimedout/.test(signals)) {
    return "TIMEOUT";
  }
  if (/replicasetnoprimary|server selection|no primary/.test(signals)) {
    return "CLUSTER_UNAVAILABLE";
  }

  return "UNKNOWN";
}

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Configuracion MongoDB incompleta: falta ${name}.`);
  }

  return value;
}

function readServerSelectionTimeout(): number {
  const configuredTimeout = Number(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ??
      DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
  );

  if (!Number.isFinite(configuredTimeout) || configuredTimeout <= 0) {
    throw new Error(
      "Configuracion MongoDB invalida: MONGODB_SERVER_SELECTION_TIMEOUT_MS debe ser un numero positivo.",
    );
  }

  return configuredTimeout;
}

function createMongoClient(): MongoClient {
  const uri = requireEnvironmentVariable("MONGODB_URI");
  const username = requireEnvironmentVariable("MONGODB_USERNAME");
  const password = requireEnvironmentVariable("MONGODB_PASSWORD");

  let authenticatedUri: string;

  try {
    const parsedUri = new URL(uri);

    if (parsedUri.protocol !== "mongodb+srv:") {
      throw new Error("unsupported protocol");
    }

    parsedUri.username = username;
    parsedUri.password = password;
    parsedUri.searchParams.set("authSource", "admin");
    authenticatedUri = parsedUri.toString();
  } catch {
    throw new Error(
      "Configuracion MongoDB invalida: MONGODB_URI debe ser una URI mongodb+srv valida.",
    );
  }

  const options: MongoClientOptions = {
    appName: "CentinelaOrinoco",
    family: 4,
    retryReads: true,
    retryWrites: true,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    serverSelectionTimeoutMS: readServerSelectionTimeout(),
  };

  return new MongoClient(authenticatedUri, options);
}

async function establishConnection(): Promise<Db> {
  const client = createMongoClient();
  const databaseName =
    process.env.MONGODB_DATABASE?.trim() || DEFAULT_DATABASE;

  try {
    await client.connect();
    const database = client.db(databaseName);
    await database.command({ ping: 1 });

    mongoClient = client;
    mongoDatabase = database;

    return database;
  } catch (error) {
    await client.close().catch(() => undefined);
    throw new MongoConnectionError(classifyConnectionFailure(error));
  }
}

export async function getMongoDatabase(): Promise<Db> {
  if (mongoDatabase) {
    return mongoDatabase;
  }

  if (!connectionPromise) {
    connectionPromise = establishConnection().finally(() => {
      connectionPromise = null;
    });
  }

  return connectionPromise;
}

export async function pingMongoDatabase(): Promise<MongoHealthStatus> {
  const database = await getMongoDatabase();
  await database.command({ ping: 1 });

  return {
    connected: true,
    database: database.databaseName,
  };
}

export async function closeMongoConnection(): Promise<void> {
  const client = mongoClient;

  mongoClient = null;
  mongoDatabase = null;
  connectionPromise = null;

  if (client) {
    await client.close();
  }
}


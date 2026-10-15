import {
  closeMongoConnection,
  pingMongoDatabase,
} from "../db/mongoClient";

async function main(): Promise<void> {
  try {
    const health = await pingMongoDatabase();
    console.log(
      `[MongoDB] Conexion verificada. Base de datos: ${health.database}.`,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo verificar la conexion con MongoDB.";

    console.error(`[MongoDB] ${message}`);
    process.exitCode = 1;
  } finally {
    await closeMongoConnection();
  }
}

void main();


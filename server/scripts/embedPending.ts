import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

/** Vectoriza a mano los documentos RAG pendientes (npm run rag:embed). */
async function main(): Promise<void> {
  const { getSupabaseServerClient } = await import("../satelliteScheduler");
  const { aiModelCascadeManager } = await import("../aiModelManager");
  const { embedPendingDocuments } = await import("../embeddingWorker");

  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase no está configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");

  const result = await embedPendingDocuments(supabase, aiModelCascadeManager.getGeminiClient());
  console.log(`Vectorizados: ${result.embedded} · Fallidos: ${result.failed} · Pendientes: ${result.pending ?? "?"}`);
  if (result.stoppedReason) {
    console.error(`Detenido: ${result.stoppedReason}`);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err?.message || err);
  process.exitCode = 1;
});

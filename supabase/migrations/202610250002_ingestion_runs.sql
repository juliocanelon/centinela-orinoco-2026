-- =============================================================================
-- Centinela Orinoco: historial de ejecuciones del planificador de ingesta.
-- Una fila por ejecución (~15 al día). Permite retomar la cadencia tras un
-- reinicio del servidor y mostrar nuevos / omitidos por ejecución.
-- =============================================================================

begin;

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  task_key text not null,
  trigger text not null check (trigger in ('SCHEDULED', 'MANUAL', 'CRON')),
  status text not null check (status in ('SUCCESS', 'PARTIAL', 'ERROR')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  records_received integer not null default 0,
  records_inserted integer not null default 0,
  records_skipped integer not null default 0,
  rag_documents_inserted integer not null default 0,
  message text,
  endpoint_url text
);
create index if not exists idx_ingestion_runs_task_started on public.ingestion_runs (task_key, started_at desc);

alter table public.ingestion_runs enable row level security;
drop policy if exists "Lectura publica ejecuciones de ingesta" on public.ingestion_runs;
create policy "Lectura publica ejecuciones de ingesta" on public.ingestion_runs for select using (true);
grant select on public.ingestion_runs to anon, authenticated;
grant all on public.ingestion_runs to service_role;

commit;

-- =============================================================================
-- Centinela Orinoco: memoria semántica vectorial y espacial.
-- Agrega el embedding (Gemini gemini-embedding-001, 768 dimensiones) y una
-- geometría a environmental_rag_documents, y la RPC que combina similitud
-- coseno y distancia geodésica en una sola consulta. Los documentos se
-- insertan sin embedding; el servidor los vectoriza después por lotes.
-- =============================================================================

begin;

set local search_path to 'public', 'extensions';

create extension if not exists vector with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Columnas
-- -----------------------------------------------------------------------------
alter table public.environmental_rag_documents
  add column if not exists embedding vector(768),
  add column if not exists embedding_model text,
  add column if not exists embedded_at timestamptz;

alter table public.environmental_rag_documents
  add column if not exists geom geometry(Point, 4326) generated always as (
    case when latitude is not null and longitude is not null
      then st_setsrid(st_makepoint(longitude, latitude), 4326) end
  ) stored;

-- -----------------------------------------------------------------------------
-- 2. Índices
-- -----------------------------------------------------------------------------
create index if not exists idx_rag_documents_embedding_hnsw
  on public.environmental_rag_documents
  using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

create index if not exists idx_rag_documents_geom
  on public.environmental_rag_documents using gist (geom);

-- Documentos pendientes de vectorizar (el worker los busca en cada pasada).
create index if not exists idx_rag_documents_pending_embedding
  on public.environmental_rag_documents (created_at)
  where embedding is null;

-- -----------------------------------------------------------------------------
-- 3. Búsqueda: similitud coseno + filtro espacial opcional
-- -----------------------------------------------------------------------------
create or replace function public.match_environmental_documents(
  query_embedding vector(768),
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_threshold double precision default 0.65,
  p_k integer default 20
)
returns table (
  id uuid,
  doc_type text,
  source_reference_id text,
  title text,
  location_name text,
  sub_basin text,
  latitude double precision,
  longitude double precision,
  content_chunk text,
  metadata jsonb,
  created_at timestamptz,
  similarity double precision,
  distance_km double precision
)
language sql
stable
set search_path to 'public', 'extensions'
as $$
  with target as (
    select case when p_lat is not null and p_lng is not null
      then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end as point
  )
  select
    d.id,
    d.doc_type,
    d.source_reference_id,
    d.title,
    d.location_name,
    d.sub_basin,
    d.latitude,
    d.longitude,
    d.content_chunk,
    d.metadata,
    d.created_at,
    1 - (d.embedding <=> query_embedding) as similarity,
    case when t.point is not null and d.geom is not null
      then st_distance(d.geom::geography, t.point) / 1000.0 end as distance_km
  from public.environmental_rag_documents d
  cross join target t
  where d.embedding is not null
    and 1 - (d.embedding <=> query_embedding) >= p_threshold
    and (
      t.point is null
      or p_radius_km is null
      or (d.geom is not null and st_dwithin(d.geom::geography, t.point, p_radius_km * 1000))
    )
  order by d.embedding <=> query_embedding
  limit least(greatest(coalesce(p_k, 20), 1), 100);
$$;

revoke all on function public.match_environmental_documents(vector, double precision, double precision, double precision, double precision, integer) from public, anon, authenticated;
grant execute on function public.match_environmental_documents(vector, double precision, double precision, double precision, double precision, integer) to service_role;

commit;

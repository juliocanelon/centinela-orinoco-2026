-- =============================================================================
-- Centinela Orinoco: ingesta satelital e hidrológica real (Nivel 1)
--
-- 1. Seguridad: las tablas satelitales pasan a lectura pública y escritura solo
--    desde el servidor (service_role, que omite RLS).
-- 2. Elimina los datos simulados que quedaban (focos, SAR, Sentinel-2, hidrología).
-- 3. Tablas de catálogo real: sentinel1_scenes, s2_product_tile (por producto),
--    sentinel3_products.
-- 4. Hidrología con los campos reales de INAMEH (nivel, variación, cota de
--    desborde). Sin turbidez, pH, oxígeno ni mercurio: INAMEH no los publica y
--    no se pueden medir desde satélite.
-- 5. Claves únicas para que ninguna ingesta duplique registros.
-- 6. RPCs que leen las tablas reales, sin valores por defecto inventados.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Políticas RLS: lectura pública, escritura solo service_role
-- -----------------------------------------------------------------------------
drop policy if exists "Acceso total nasa_firms" on public.nasa_firms_hotspots;
drop policy if exists "Lectura publica focos FIRMS" on public.nasa_firms_hotspots;
create policy "Lectura publica focos FIRMS" on public.nasa_firms_hotspots
  for select using (true);

drop policy if exists "Acceso total copernicus_sar" on public.copernicus_sar_disturbances;
drop policy if exists "Acceso total sentinel_sar" on public.copernicus_sar_disturbances;
drop policy if exists "Lectura publica perturbaciones SAR" on public.copernicus_sar_disturbances;
create policy "Lectura publica perturbaciones SAR" on public.copernicus_sar_disturbances
  for select using (true);

drop policy if exists "Acceso total s2_tile" on public.s2_product_tile;
drop policy if exists "Acceso total s2_tiles" on public.s2_product_tile;
drop policy if exists "Acceso total s2_bands" on public.s2_tile_bands;

-- -----------------------------------------------------------------------------
-- 1. NASA FIRMS
-- -----------------------------------------------------------------------------
-- Focos generados por el planificador simulado (sin fuente de API).
delete from public.nasa_firms_hotspots where metadata->>'api_source' is null;

-- Confianza normalizada al vocabulario de la app.
update public.nasa_firms_hotspots
set confidence = case confidence when 'h' then 'high' when 'n' then 'nominal' when 'l' then 'low' else confidence end
where confidence in ('h', 'n', 'l');

alter table public.nasa_firms_hotspots add column if not exists source_product text;
alter table public.nasa_firms_hotspots add column if not exists instrument text;
alter table public.nasa_firms_hotspots add column if not exists state_name text;

update public.nasa_firms_hotspots
set source_product = 'VIIRS_NOAA20_NRT', instrument = 'VIIRS'
where source_product is null and metadata->>'api_source' = 'NASA_FIRMS_AREA_CSV';

update public.nasa_firms_hotspots
set geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
where geom is null;

create index if not exists idx_firms_acq_date on public.nasa_firms_hotspots (acq_date desc);
create index if not exists idx_firms_geom on public.nasa_firms_hotspots using gist (geom);

-- -----------------------------------------------------------------------------
-- 2. Sentinel-1: catálogo de escenas reales (STAC)
-- -----------------------------------------------------------------------------
create table if not exists public.sentinel1_scenes (
  scene_id text primary key,
  platform text not null,
  acquired_at timestamptz not null,
  instrument_mode text,
  product_type text,
  polarizations text[],
  orbit_state text,
  relative_orbit integer,
  absolute_orbit integer,
  center_lat double precision,
  center_lon double precision,
  footprint geometry(Geometry, 4326),
  stac_item_url text,
  ingested_at timestamptz not null default now()
);
create index if not exists idx_s1_acquired_at on public.sentinel1_scenes (acquired_at desc);
create index if not exists idx_s1_footprint on public.sentinel1_scenes using gist (footprint);
alter table public.sentinel1_scenes enable row level security;
drop policy if exists "Lectura publica escenas Sentinel-1" on public.sentinel1_scenes;
create policy "Lectura publica escenas Sentinel-1" on public.sentinel1_scenes for select using (true);

-- -----------------------------------------------------------------------------
-- 3. Sentinel-2: una fila por producto (antes por cuadrante, que sobrescribía)
-- -----------------------------------------------------------------------------
delete from public.s2_tile_bands;
delete from public.s2_product_tile;

-- Las bandas apuntaban al cuadrante (tile_id), que deja de ser único. En el Nivel 1
-- no se descargan bandas; la tabla queda vacía y sin esa clave foránea.
alter table public.s2_tile_bands drop constraint if exists s2_tile_bands_tile_id_fkey;
alter table public.s2_product_tile drop constraint if exists s2_product_tile_pkey;
alter table public.s2_product_tile add column if not exists product_id text;
alter table public.s2_product_tile add column if not exists relative_orbit integer;
alter table public.s2_product_tile add column if not exists center_lat double precision;
alter table public.s2_product_tile add column if not exists center_lon double precision;
alter table public.s2_product_tile add column if not exists stac_item_url text;
alter table public.s2_product_tile alter column product_id set not null;
alter table public.s2_product_tile add constraint s2_product_tile_pkey primary key (product_id);
create index if not exists idx_s2_tile_id on public.s2_product_tile (tile_id);

-- -----------------------------------------------------------------------------
-- 4. Sentinel-3: catálogo OData (OLCI WFR y SLSTR WST), solo metadatos
-- -----------------------------------------------------------------------------
create table if not exists public.sentinel3_products (
  product_id text primary key,
  product_name text not null unique,
  platform text not null,
  instrument text not null check (instrument in ('OLCI', 'SLSTR')),
  product_type text not null,
  sensing_start timestamptz not null,
  sensing_end timestamptz,
  content_length_bytes bigint,
  online boolean,
  center_lat double precision,
  center_lon double precision,
  footprint geometry(Geometry, 4326),
  odata_url text not null,
  ingested_at timestamptz not null default now()
);
create index if not exists idx_s3_sensing_start on public.sentinel3_products (sensing_start desc);
create index if not exists idx_s3_footprint on public.sentinel3_products using gist (footprint);
alter table public.sentinel3_products enable row level security;
drop policy if exists "Lectura publica productos Sentinel-3" on public.sentinel3_products;
create policy "Lectura publica productos Sentinel-3" on public.sentinel3_products for select using (true);

-- -----------------------------------------------------------------------------
-- 5. Hidrología INAMEH
-- -----------------------------------------------------------------------------
-- Las lecturas previas mezclaban niveles con turbidez, pH y mercurio inventados
-- y fechaban la lectura con la hora de ingesta: se reemplazan por el esquema real.
-- La vista station_current_telemetry dependía de ellas y no la usa el código.
drop view if exists public.station_current_telemetry;
drop table if exists public.hydrological_telemetry_readings;
drop table if exists public.environmental_monitoring_stations;

create table public.environmental_monitoring_stations (
  station_code text primary key,
  name text not null,
  river text not null,
  state text not null,
  latitude double precision not null,
  longitude double precision not null,
  geom geometry(Point, 4326) generated always as (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) stored,
  overflow_level_msnm numeric(7, 2),
  historical_max_msnm numeric(7, 2),
  historical_max_note text,
  historical_min_msnm numeric(7, 2),
  historical_min_note text,
  page_url text not null,
  latest_reading_date date,
  latest_level_msnm numeric(7, 2),
  latest_change_m numeric(6, 2),
  latest_trend text,
  latest_alert_status text,
  latest_is_stale boolean,
  updated_at timestamptz not null default now()
);
alter table public.environmental_monitoring_stations enable row level security;
create policy "Lectura publica estaciones" on public.environmental_monitoring_stations for select using (true);

-- Metadatos publicados en los boletines PDF de INAMEH (consultados 24/10/2026).
insert into public.environmental_monitoring_stations
  (station_code, name, river, state, latitude, longitude, overflow_level_msnm,
   historical_max_msnm, historical_max_note, historical_min_msnm, historical_min_note, page_url)
values
  ('0850', 'Estación Hidrométrica Puerto Ayacucho', 'Río Orinoco', 'Amazonas', 5.6708, -67.6305, 52.00,
   54.28, '11 de agosto de 2018', 39.36, '05 de abril de 1967', 'http://www.inameh.gob.ve/web/roayacucho.php'),
  ('0855', 'Estación Hidrométrica Caicara del Orinoco', 'Río Orinoco', 'Bolívar', 7.7467, -66.1792, 35.00,
   36.45, '2 al 5 de agosto de 1981', 20.53, '20 de febrero de 2010', 'http://www.inameh.gob.ve/web/rocaicara.php'),
  ('0870', 'Estación Hidrométrica Ciudad Bolívar', 'Río Orinoco', 'Bolívar', 8.1333, -65.5333, null,
   18.34, '25 de agosto de 2018', 1.58, '17 y 18 de marzo de 1959', 'http://www.inameh.gob.ve/web/robolivar.php'),
  ('0875', 'Estación Hidrométrica Palúa', 'Río Orinoco', 'Bolívar', 8.3636, -62.6919, 12.50,
   13.01, '3 y 4 de agosto de 1976', 0.79, '01 de abril de 1985', 'http://www.inameh.gob.ve/web/ropalua.php');

create table public.hydrological_telemetry_readings (
  id uuid primary key default gen_random_uuid(),
  station_code text not null references public.environmental_monitoring_stations (station_code),
  reading_date date not null,
  level_msnm numeric(7, 2) not null,
  previous_reading_date date,
  previous_level_msnm numeric(7, 2),
  daily_change_m numeric(6, 2),
  trend text check (trend in ('SUBIENDO', 'BAJANDO', 'ESTABLE')),
  overflow_level_msnm numeric(7, 2),
  margin_to_overflow_m numeric(7, 2),
  alert_status text not null check (alert_status in ('OPTIMAL', 'ELEVATED', 'ALERT_CRECIDA', 'SIN_REFERENCIA')),
  bulletin_pdf_url text not null,
  is_stale boolean not null default false,
  ingested_at timestamptz not null default now(),
  constraint uq_hydro_station_date unique (station_code, reading_date)
);
create index idx_hydro_reading_date on public.hydrological_telemetry_readings (reading_date desc);
alter table public.hydrological_telemetry_readings enable row level security;
create policy "Lectura publica lecturas hidrometricas" on public.hydrological_telemetry_readings for select using (true);

-- -----------------------------------------------------------------------------
-- 6. Documentos RAG
-- -----------------------------------------------------------------------------
alter table public.environmental_rag_documents
  add column if not exists content_hash text generated always as (md5(coalesce(content_chunk, ''))) stored;
drop index if exists public.uq_rag_document;
create unique index if not exists uq_rag_document_hash
  on public.environmental_rag_documents (doc_type, source_reference_id, content_hash);

-- Documentos de fuentes simuladas o con afirmaciones no medibles (pH, conductividad,
-- mercurio): se regeneran desde la ingesta real.
delete from public.environmental_rag_documents
where doc_type in ('HYDRO_TELEMETRY', 'SENTINEL_1_SAR', 'SENTINEL_2_MSI', 'SENTINEL_3_OLCI_SLSTR', 'NASA_FIRMS');

-- -----------------------------------------------------------------------------
-- 7. Perturbaciones SAR: las 7 filas eran inventadas. Se llenará en el Nivel 2.
-- -----------------------------------------------------------------------------
delete from public.copernicus_sar_disturbances;

-- -----------------------------------------------------------------------------
-- 8. RPCs sobre datos reales
-- -----------------------------------------------------------------------------
create or replace function public.get_heat_anomalies_geojson(
  p_min_confidence text default 'nominal',
  p_limit integer default 500
)
returns jsonb
language sql
stable
set search_path to 'public', 'extensions'
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', jsonb_build_object('type', 'Point', 'coordinates', jsonb_build_array(h.longitude, h.latitude)),
        'properties', jsonb_build_object(
          'id', coalesce(h.firms_id, h.id::text),
          'satellite', h.satellite,
          'latitude', h.latitude,
          'longitude', h.longitude,
          'brightnessTempK', h.brightness_temp_k,
          'frpMw', h.frp_mw,
          'confidence', h.confidence,
          'acqDate', to_char(h.acq_date, 'YYYY-MM-DD'),
          'acqTime', h.acq_time,
          'dayNight', h.day_night,
          'sector', h.sector_name,
          'subBasin', coalesce(h.state_name, 'Otro estado')
        )
      )
    ), '[]'::jsonb)
  )
  from (
    select *
    from public.nasa_firms_hotspots
    where acq_date >= current_date - 7
      and case coalesce(p_min_confidence, 'nominal')
            when 'high' then confidence = 'high'
            when 'nominal' then confidence in ('nominal', 'high')
            else true
          end
    order by acq_date desc, acq_time desc
    limit greatest(1, least(coalesce(p_limit, 500), 5000))
  ) h;
$$;

create or replace function public.get_mining_clusters_geojson(
  p_basin_id text default null,
  p_min_severity text default 'LOW'
)
returns jsonb
language sql
stable
set search_path to 'public', 'extensions'
as $$
  -- Solo perturbaciones SAR medidas (Nivel 2). Sin filas, devuelve una colección vacía.
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', jsonb_build_object('type', 'Point', 'coordinates', jsonb_build_array(d.centroid_lng, d.centroid_lat)),
        'properties', jsonb_build_object(
          'id', d.code,
          'name', d.sector_name,
          'basin', d.sub_basin,
          'latitude', d.centroid_lat,
          'longitude', d.centroid_lng,
          'severity', d.severity,
          'activityType', 'monitoreo_radar_sar',
          'backscatterDiffDb', d.backscatter_diff_db,
          'affectedAreaHa', d.affected_area_ha,
          'detectedAt', d.created_at
        )
      )
    ), '[]'::jsonb)
  )
  from public.copernicus_sar_disturbances d
  where p_basin_id is null or d.sub_basin ilike '%' || p_basin_id || '%';
$$;

create or replace function public.get_hydrological_telemetry(
  p_station_id text default null,
  p_hours integer default 24
)
returns json
language sql
stable
set search_path to 'public', 'extensions'
as $$
  select coalesce(json_agg(
    json_build_object(
      'id', s.station_code,
      'name', s.name,
      'river', s.river,
      'state', s.state,
      'coordinates', json_build_array(s.longitude, s.latitude),
      'currentLevelM', s.latest_level_msnm,
      'dailyChangeM', s.latest_change_m,
      'trend', s.latest_trend,
      'overflowLevelM', s.overflow_level_msnm,
      'historicalMaxM', s.historical_max_msnm,
      'historicalMinM', s.historical_min_msnm,
      'status', coalesce(s.latest_alert_status, 'SIN_REFERENCIA'),
      'readingDate', to_char(s.latest_reading_date, 'YYYY-MM-DD'),
      'isStale', coalesce(s.latest_is_stale, true),
      'sourceUrl', s.page_url,
      'lastTelemetry', to_char(s.updated_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"')
    ) order by s.station_code
  ), '[]'::json)
  from public.environmental_monitoring_stations s
  where p_station_id is null or s.station_code = p_station_id;
$$;

create or replace function public.calculate_basin_risk_index(p_basin_id text default null)
returns jsonb
language sql
stable
set search_path to 'public', 'extensions'
as $$
  -- Conteos reales de los últimos 7 días. El índice compuesto (turbidez, SAR,
  -- riesgo de mercurio) requiere el Nivel 2 y no se calcula aquí.
  select jsonb_build_object(
    'basin_id', p_basin_id,
    'riskScore', null,
    'riskCategory', null,
    'note', 'Índice compuesto pendiente del Nivel 2 (turbidez Sentinel-2, perturbación SAR, riesgo de mercurio).',
    'breakdown', jsonb_build_object(
      'firms_hotspots_7d', (select count(*) from public.nasa_firms_hotspots
                            where acq_date >= current_date - 7
                              and (p_basin_id is null or state_name ilike '%' || p_basin_id || '%')),
      'firms_high_confidence_7d', (select count(*) from public.nasa_firms_hotspots
                                   where acq_date >= current_date - 7 and confidence = 'high'
                                     and (p_basin_id is null or state_name ilike '%' || p_basin_id || '%')),
      'sar_disturbances', (select count(*) from public.copernicus_sar_disturbances
                           where p_basin_id is null or sub_basin ilike '%' || p_basin_id || '%')
    ),
    'calculated_at', now()
  );
$$;

grant execute on function public.get_heat_anomalies_geojson(text, integer) to anon, authenticated, service_role;
grant execute on function public.get_mining_clusters_geojson(text, text) to anon, authenticated, service_role;
grant execute on function public.get_hydrological_telemetry(text, integer) to anon, authenticated, service_role;
grant execute on function public.calculate_basin_risk_index(text) to anon, authenticated, service_role;
grant select on public.sentinel1_scenes, public.sentinel3_products,
  public.environmental_monitoring_stations, public.hydrological_telemetry_readings to anon, authenticated;
grant all on public.sentinel1_scenes, public.sentinel3_products,
  public.environmental_monitoring_stations, public.hydrological_telemetry_readings to service_role;

commit;

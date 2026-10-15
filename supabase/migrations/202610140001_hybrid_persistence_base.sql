-- Centinela Orinoco
-- Base relacional para persistencia poliglota PostgreSQL + MongoDB.
-- Esta migracion es idempotente y no inserta datos de demostracion.

begin;

create extension if not exists pgcrypto;
create extension if not exists postgis;

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  category text not null check (
    category in (
      'MINERIA_ILEGAL',
      'CONTAMINACION_HIDRICA',
      'DERRAME_HIDROCARBUROS',
      'DEFORESTACION',
      'AFECTACION_FAUNA_FLORA',
      'INVASION_ABRAE',
      'OTRO'
    )
  ),
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text not null default 'PENDIENTE_VALIDACION' check (
    status in (
      'PENDIENTE_VALIDACION',
      'CONFIRMADA_EN_TERRENO',
      'OPERATIVO_ENVIADO',
      'DESESTIMADA'
    )
  ),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  geom geometry(Point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)
  ) stored,
  location_name text not null check (char_length(btrim(location_name)) > 0),
  community_name text,
  description text not null check (char_length(btrim(description)) >= 10),
  is_anonymous boolean not null default true,
  reporter_name text,
  reporter_contact text,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  verified_by text,
  linked_incident_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_reports_anonymous_privacy_chk check (
    not is_anonymous or (reporter_name is null and reporter_contact is null)
  )
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  source_report_id uuid unique references public.community_reports(id)
    on update restrict on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 250),
  category text not null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text not null default 'OPEN' check (
    status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')
  ),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  geom geometry(Point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)
  ) stored,
  location_name text not null,
  description text not null,
  reported_by text not null,
  assigned_unit text,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  constraint incidents_cancellation_consistency_chk check (
    (status = 'CANCELLED' and cancelled_at is not null)
    or
    (status <> 'CANCELLED' and cancelled_at is null and cancellation_reason is null)
  )
);

alter table public.community_reports
  drop constraint if exists community_reports_linked_incident_fk;

alter table public.community_reports
  add constraint community_reports_linked_incident_fk
  foreign key (linked_incident_id) references public.incidents(id)
  on update restrict on delete restrict;

create table if not exists public.integration_operations (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null check (
    operation_type in ('ELEVATE_COMMUNITY_REPORT')
  ),
  idempotency_key text not null unique check (char_length(btrim(idempotency_key)) > 0),
  request_hash text not null check (char_length(request_hash) = 64),
  source_report_id uuid references public.community_reports(id)
    on update restrict on delete restrict,
  incident_id uuid references public.incidents(id)
    on update restrict on delete restrict,
  status text not null default 'PENDING' check (
    status in (
      'PENDING',
      'POSTGRES_COMMITTED',
      'COMPLETED',
      'COMPENSATING',
      'COMPENSATED',
      'FAILED_RETRYABLE',
      'FAILED_FINAL'
    )
  ),
  current_step text not null default 'VALIDATING',
  attempt_count integer not null default 1 check (attempt_count >= 1),
  error_code text,
  error_summary text,
  response_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint integration_operations_completion_chk check (
    (status = 'COMPLETED' and completed_at is not null)
    or status <> 'COMPLETED'
  )
);

create or replace function public.centinela_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists community_reports_set_updated_at on public.community_reports;
create trigger community_reports_set_updated_at
before update on public.community_reports
for each row execute function public.centinela_set_updated_at();

drop trigger if exists incidents_set_updated_at on public.incidents;
create trigger incidents_set_updated_at
before update on public.incidents
for each row execute function public.centinela_set_updated_at();

drop trigger if exists integration_operations_set_updated_at
  on public.integration_operations;
create trigger integration_operations_set_updated_at
before update on public.integration_operations
for each row execute function public.centinela_set_updated_at();

create index if not exists community_reports_created_at_idx
  on public.community_reports (created_at desc);
create index if not exists community_reports_status_idx
  on public.community_reports (status, created_at desc);
create index if not exists community_reports_geom_gix
  on public.community_reports using gist (geom);

create index if not exists incidents_created_at_idx
  on public.incidents (created_at desc);
create index if not exists incidents_severity_category_idx
  on public.incidents (severity, category);
create index if not exists incidents_status_idx
  on public.incidents (status, created_at desc);
create index if not exists incidents_geom_gix
  on public.incidents using gist (geom);

create index if not exists integration_operations_status_updated_idx
  on public.integration_operations (status, updated_at);
create index if not exists integration_operations_source_report_idx
  on public.integration_operations (source_report_id, created_at desc);

alter table public.community_reports enable row level security;
alter table public.incidents enable row level security;
alter table public.integration_operations enable row level security;

revoke all on public.community_reports from anon, authenticated;
revoke all on public.incidents from anon, authenticated;
revoke all on public.integration_operations from anon, authenticated;

grant all on public.community_reports to service_role;
grant all on public.incidents to service_role;
grant all on public.integration_operations to service_role;

comment on table public.community_reports is
  'Denuncias comunitarias normalizadas; archivos y metadatos variables no se almacenan aqui.';
comment on table public.incidents is
  'Fuente de verdad operacional de incidentes ambientales.';
comment on table public.integration_operations is
  'Bitacora e idempotencia de las sagas entre PostgreSQL y MongoDB.';

notify pgrst, 'reload schema';

commit;

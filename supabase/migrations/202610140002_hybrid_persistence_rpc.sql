-- Centinela Orinoco
-- RPCs transaccionales para la saga PostgreSQL + MongoDB.

begin;

create or replace function public.start_hybrid_incident_elevation(
  p_source_report_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_assigned_unit text default null,
  p_reported_by text default 'Sistema Centinela'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.integration_operations%rowtype;
  v_report public.community_reports%rowtype;
  v_incident public.incidents%rowtype;
  v_operation_id uuid;
  v_incident_id uuid;
  v_incident_code text;
begin
  if p_source_report_id is null
     or p_idempotency_key is null
     or char_length(btrim(p_idempotency_key)) = 0
     or p_request_hash is null
     or p_request_hash !~ '^[0-9a-fA-F]{64}$' then
    return jsonb_build_object(
      'success', false,
      'error_code', 'VALIDATION_ERROR',
      'message', 'Los parametros de idempotencia y la denuncia son obligatorios.'
    );
  end if;

  select * into v_operation
  from public.integration_operations
  where idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_operation.request_hash <> lower(p_request_hash) then
      return jsonb_build_object(
        'success', false,
        'error_code', 'IDEMPOTENCY_CONFLICT',
        'operation_id', v_operation.id
      );
    end if;

    if v_operation.response_snapshot is not null then
      return v_operation.response_snapshot || jsonb_build_object(
        'replayed', true,
        'operation_id', v_operation.id,
        'operation_status', v_operation.status
      );
    end if;

    return jsonb_build_object(
      'success', false,
      'error_code', 'OPERATION_IN_PROGRESS',
      'operation_id', v_operation.id,
      'operation_status', v_operation.status
    );
  end if;

  insert into public.integration_operations (
    operation_type,
    idempotency_key,
    request_hash,
    source_report_id,
    status,
    current_step
  ) values (
    'ELEVATE_COMMUNITY_REPORT',
    btrim(p_idempotency_key),
    lower(p_request_hash),
    p_source_report_id,
    'PENDING',
    'VALIDATING'
  )
  returning id into v_operation_id;

  select * into v_report
  from public.community_reports
  where id = p_source_report_id
  for update;

  if not found then
    update public.integration_operations
    set status = 'FAILED_FINAL',
        current_step = 'VALIDATING',
        error_code = 'REPORT_NOT_FOUND',
        error_summary = 'La denuncia de origen no existe.'
    where id = v_operation_id;

    return jsonb_build_object(
      'success', false,
      'error_code', 'REPORT_NOT_FOUND',
      'operation_id', v_operation_id
    );
  end if;

  if v_report.status <> 'CONFIRMADA_EN_TERRENO' then
    update public.integration_operations
    set status = 'FAILED_FINAL',
        current_step = 'VALIDATING',
        error_code = 'REPORT_NOT_ELIGIBLE',
        error_summary = 'La denuncia debe estar confirmada en terreno.'
    where id = v_operation_id;

    return jsonb_build_object(
      'success', false,
      'error_code', 'REPORT_NOT_ELIGIBLE',
      'operation_id', v_operation_id,
      'report_status', v_report.status
    );
  end if;

  v_incident_id := gen_random_uuid();
  -- El codigo debe seguir siendo legible, pero unico incluso despues de una
  -- compensacion que conserva el incidente cancelado para auditoria.
  v_incident_code := 'ALERTA-' || v_report.code || '-' ||
    upper(substr(replace(v_incident_id::text, '-', ''), 1, 8));

  insert into public.incidents (
    id,
    code,
    source_report_id,
    title,
    category,
    severity,
    status,
    latitude,
    longitude,
    location_name,
    description,
    reported_by,
    assigned_unit,
    evidence_count
  ) values (
    v_incident_id,
    v_incident_code,
    v_report.id,
    'Interdiccion Veeduria Comunitaria: ' || v_report.title,
    v_report.category,
    v_report.severity,
    'IN_PROGRESS',
    v_report.latitude,
    v_report.longitude,
    v_report.location_name,
    'Reporte derivado de veeduria comunitaria. ' || v_report.description,
    coalesce(p_reported_by, 'Sistema Centinela'),
    p_assigned_unit,
    v_report.evidence_count
  )
  returning * into v_incident;

  update public.community_reports
  set status = 'OPERATIVO_ENVIADO',
      linked_incident_id = v_incident.id
  where id = v_report.id;

  update public.integration_operations
  set status = 'POSTGRES_COMMITTED',
      current_step = 'POSTGRES_COMMITTED',
      incident_id = v_incident.id
  where id = v_operation_id;

  return jsonb_build_object(
    'success', true,
    'operation_id', v_operation_id,
    'operation_status', 'POSTGRES_COMMITTED',
    'incident', jsonb_build_object(
      'id', v_incident.id,
      'code', v_incident.code,
      'source_report_id', v_incident.source_report_id,
      'title', v_incident.title,
      'category', v_incident.category,
      'severity', v_incident.severity,
      'status', v_incident.status,
      'latitude', v_incident.latitude,
      'longitude', v_incident.longitude,
      'location_name', v_incident.location_name,
      'description', v_incident.description,
      'reported_by', v_incident.reported_by,
      'assigned_unit', v_incident.assigned_unit,
      'evidence_count', v_incident.evidence_count,
      'created_at', v_incident.created_at
    )
  );
end;
$$;

create or replace function public.complete_hybrid_incident_operation(
  p_operation_id uuid,
  p_response_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.integration_operations%rowtype;
begin
  select * into v_operation
  from public.integration_operations
  where id = p_operation_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error_code', 'OPERATION_NOT_FOUND'
    );
  end if;

  if v_operation.status = 'COMPLETED' then
    return coalesce(v_operation.response_snapshot, jsonb_build_object(
      'success', true,
      'operation_status', 'COMPLETED',
      'replayed', true
    ));
  end if;

  if v_operation.status <> 'POSTGRES_COMMITTED' then
    return jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_OPERATION_STATE',
      'operation_status', v_operation.status
    );
  end if;

  update public.integration_operations
  set status = 'COMPLETED',
      current_step = 'MONGODB_COMMITTED',
      response_snapshot = coalesce(p_response_snapshot, '{}'::jsonb),
      completed_at = now()
  where id = p_operation_id;

  return jsonb_build_object(
    'success', true,
    'operation_id', p_operation_id,
    'operation_status', 'COMPLETED'
  ) || coalesce(p_response_snapshot, '{}'::jsonb);
end;
$$;

create or replace function public.compensate_hybrid_incident_operation(
  p_operation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.integration_operations%rowtype;
begin
  select * into v_operation
  from public.integration_operations
  where id = p_operation_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error_code', 'OPERATION_NOT_FOUND'
    );
  end if;

  if v_operation.status = 'COMPENSATED' then
    return jsonb_build_object(
      'success', true,
      'operation_id', p_operation_id,
      'operation_status', 'COMPENSATED',
      'replayed', true
    );
  end if;

  if v_operation.incident_id is null
     or v_operation.source_report_id is null
     or v_operation.status not in ('POSTGRES_COMMITTED', 'COMPENSATING') then
    return jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_COMPENSATION_STATE',
      'operation_status', v_operation.status
    );
  end if;

  update public.integration_operations
  set status = 'COMPENSATING',
      current_step = 'COMPENSATING_POSTGRES',
      error_code = 'MONGODB_WRITE_FAILED',
      error_summary = left(coalesce(p_reason, 'Fallo no especificado.'), 500)
  where id = p_operation_id;

  update public.incidents
  set status = 'CANCELLED',
      cancelled_at = now(),
      cancellation_reason = left(coalesce(p_reason, 'Fallo no especificado.'), 500)
  where id = v_operation.incident_id;

  update public.community_reports
  set status = 'CONFIRMADA_EN_TERRENO',
      linked_incident_id = null
  where id = v_operation.source_report_id;

  update public.integration_operations
  set status = 'COMPENSATED',
      current_step = 'COMPENSATION_COMPLETED'
  where id = p_operation_id;

  return jsonb_build_object(
    'success', true,
    'operation_id', p_operation_id,
    'operation_status', 'COMPENSATED',
    'incident_id', v_operation.incident_id
  );
end;
$$;

revoke all on function public.start_hybrid_incident_elevation(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_hybrid_incident_operation(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.compensate_hybrid_incident_operation(uuid, text)
  from public, anon, authenticated;

grant execute on function public.start_hybrid_incident_elevation(uuid, text, text, text, text)
  to service_role;
grant execute on function public.complete_hybrid_incident_operation(uuid, jsonb)
  to service_role;
grant execute on function public.compensate_hybrid_incident_operation(uuid, text)
  to service_role;

notify pgrst, 'reload schema';

commit;

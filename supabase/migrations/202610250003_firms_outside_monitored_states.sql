-- =============================================================================
-- Centinela Orinoco: focos FIRMS fuera de los estados monitoreados.
-- El recuadro de consulta (-73.5,0.6,-57.0,12.2) incluye franjas de Colombia,
-- Brasil y Guyana. Los focos sin estado asignado se etiquetan como tales y no
-- alimentan el índice RAG ni las alertas.
-- =============================================================================

begin;

update public.nasa_firms_hotspots
set sub_basin = 'Fuera de los estados monitoreados'
where state_name is null;

delete from public.environmental_rag_documents d
using public.nasa_firms_hotspots h
where d.doc_type = 'NASA_FIRMS'
  and d.source_reference_id = h.firms_id
  and h.state_name is null;

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
          'subBasin', coalesce(h.state_name, 'Fuera de los estados monitoreados')
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

commit;

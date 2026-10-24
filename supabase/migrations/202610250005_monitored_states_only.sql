-- =============================================================================
-- Centinela Orinoco: la plataforma monitorea solo Amazonas, Bolívar, Delta Amacuro
-- y Guayana Esequiba. Se eliminan los focos de otros estados (y sus documentos RAG)
-- y el mapa recibe solo los de esos cuatro estados.
-- =============================================================================

begin;

delete from public.environmental_rag_documents d
using public.nasa_firms_hotspots h
where d.doc_type = 'NASA_FIRMS'
  and d.source_reference_id = h.firms_id
  and (h.state_name is null or h.state_name not in ('Amazonas', 'Bolívar', 'Delta Amacuro', 'Guayana Esequiba'));

delete from public.nasa_firms_hotspots
where state_name is null or state_name not in ('Amazonas', 'Bolívar', 'Delta Amacuro', 'Guayana Esequiba');

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
          'subBasin', h.state_name
        )
      )
    ), '[]'::jsonb)
  )
  from (
    select *
    from public.nasa_firms_hotspots
    where acq_date >= current_date - 7
      and state_name in ('Amazonas', 'Bolívar', 'Delta Amacuro', 'Guayana Esequiba')
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

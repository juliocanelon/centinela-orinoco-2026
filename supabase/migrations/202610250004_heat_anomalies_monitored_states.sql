-- =============================================================================
-- Centinela Orinoco: el mapa recibe solo focos dentro de los estados monitoreados.
-- Coherente con el índice RAG y las alertas (los focos de Colombia, Brasil y
-- Guyana dentro del recuadro de consulta se conservan en la tabla, pero no se
-- muestran como focos venezolanos).
-- =============================================================================

begin;

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
      and state_name is not null
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

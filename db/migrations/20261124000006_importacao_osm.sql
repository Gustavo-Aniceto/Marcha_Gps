-- Marcha GPS — importação automática de lombadas, valetas e radares do OpenStreetMap.
-- O Worker marcha-gps-api baixa o CSV do Overpass (uma cidade por vez, toda semana)
-- e chama import_osm_obstacles() com o usuário "importador", que só pode fazer isso.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'importador') then
    create role importador nologin;  -- no Neon o usuário é criado pelo painel/API, com senha
  end if;
end $$;

create or replace function public.import_osm_obstacles(p_city text, p_csv text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r      record;
  v_new  integer := 0;
begin
  if not exists (select 1 from public.cities where id = p_city) then raise exception 'cidade_invalida'; end if;
  if length(p_csv) > 20000000 then raise exception 'arquivo_grande'; end if;

  for r in
    with linhas as (
      select string_to_table(p_csv, E'\n') as l
    ), campos as (
      select split_part(l, E'\t', 1) as tipo, split_part(l, E'\t', 2) as osm_id,
             split_part(l, E'\t', 3) as lat_t, split_part(l, E'\t', 4) as lon_t,
             split_part(l, E'\t', 5) as calming, split_part(l, E'\t', 6) as highway,
             split_part(l, E'\t', 7) as hazard, split_part(l, E'\t', 8) as maxspeed
        from linhas
    ), validos as (
      select * from campos
       where tipo in ('node', 'way') and osm_id ~ '^[0-9]{1,15}$'
         and lat_t ~ '^-?[0-9]{1,3}\.[0-9]+$' and lon_t ~ '^-?[0-9]{1,3}\.[0-9]+$'
    ), mapeados as (
      select v.tipo || '/' || v.osm_id as ref, v.lat_t::double precision as lat, v.lon_t::double precision as lon,
             case when v.maxspeed ~ '^[0-9]{1,3}$' and v.maxspeed::int between 1 and 199 then v.maxspeed::int end as speed,
             m.kind, m.risk
        from validos v
        cross join lateral (
          select 'radar'::text as kind, 0 as risk where v.highway = 'speed_camera'
          union all
          select 'lombada', 2 where v.highway <> 'speed_camera' and v.hazard = 'bump' and v.calming = ''
          union all
          (select t.kind, t.risk
             from unnest(string_to_array(v.calming, ';')) as c(val)
             join (values ('bump', 'lombada', 3), ('hump', 'lombada', 2), ('mini_bumps', 'lombada', 2),
                          ('table', 'faixa_elevada', 2), ('cushion', 'lombada', 2), ('dip', 'valeta', 3),
                          ('double_dip', 'valeta', 3), ('rumble_strip', 'sonorizador', 1), ('yes', 'lombada', 2))
                  as t(val, kind, risk) on t.val = btrim(c.val)
            where v.highway <> 'speed_camera'
            order by t.risk desc limit 1)
        ) m
    )
    select * from mapeados order by ref
  loop
    -- já importado (mesmo ponto do OSM) ou já existe aviso igual a menos de 15 m: pula
    continue when exists (select 1 from public.reports where source = 'osm' and source_ref = r.ref);
    continue when exists (
      select 1 from public.reports x
       where x.kind = r.kind and x.status in ('unconfirmed', 'confirmed')
         and abs(x.lat - r.lat) < 0.0002 and abs(x.lon - r.lon) < 0.0002
         and public.haversine_m(x.lat, x.lon, r.lat, r.lon) < 15);
    insert into public.reports (kind, lat, lon, city_id, source, source_ref, base_risk, speed_limit, status)
    values (r.kind, r.lat, r.lon, p_city, 'osm', r.ref, r.risk, r.speed, 'unconfirmed');
    v_new := v_new + 1;
  end loop;
  return v_new;
end $$;

revoke execute on function public.import_osm_obstacles(text, text) from public, anonymous, authenticated;
grant execute on function public.import_osm_obstacles(text, text) to importador;

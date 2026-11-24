-- Marcha GPS — importação do OpenStreetMap por faixas de mapa (consulta mais leve pro Overpass)
-- e com controle de quando cada faixa rodou: o agendamento tenta de hora em hora, mas cada faixa
-- só é importada de novo depois de 6 dias (e no máximo uma tentativa por hora se der erro).

create table public.import_runs (
  tile       text primary key,
  ok_at      timestamptz,
  last_try   timestamptz,
  rows_new   integer
);
alter table public.import_runs enable row level security;  -- sem policies: só as funções abaixo mexem
revoke all on public.import_runs from anonymous, authenticated;

-- Faixa precisa rodar? Já marca a tentativa pra dois disparos não pegarem a mesma faixa.
create or replace function public.osm_import_due(p_tile text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_due boolean;
begin
  if p_tile !~ '^[a-z_]{1,30}$' then raise exception 'faixa_invalida'; end if;
  insert into public.import_runs (tile) values (p_tile) on conflict do nothing;
  update public.import_runs
     set last_try = now()
   where tile = p_tile
     and (ok_at is null or ok_at < now() - interval '6 days')
     and (last_try is null or last_try < now() - interval '50 minutes')
  returning true into v_due;
  return coalesce(v_due, false);
end $$;

-- Agora a cidade de cada ponto vem da posição (city_for); ponto fora das 3 cidades é ignorado.
-- p_tile = nome da faixa (ou o id de uma cidade, pra forçar a cidade como antes).
-- (o parâmetro continua se chamando p_city por compatibilidade; agora é o nome da faixa)
create or replace function public.import_osm_obstacles(p_city text, p_csv text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r       record;
  v_city  text;
  v_new   integer := 0;
  v_force text := (select id from public.cities where id = p_city);
begin
  if p_city !~ '^[a-z_]{1,30}$' then raise exception 'faixa_invalida'; end if;
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
    v_city := coalesce(v_force, public.city_for(r.lat, r.lon));
    continue when v_city is null;
    continue when exists (select 1 from public.reports where source = 'osm' and source_ref = r.ref);
    continue when exists (
      select 1 from public.reports x
       where x.kind = r.kind and x.status in ('unconfirmed', 'confirmed')
         and abs(x.lat - r.lat) < 0.0002 and abs(x.lon - r.lon) < 0.0002
         and public.haversine_m(x.lat, x.lon, r.lat, r.lon) < 15);
    insert into public.reports (kind, lat, lon, city_id, source, source_ref, base_risk, speed_limit, status)
    values (r.kind, r.lat, r.lon, v_city, 'osm', r.ref, r.risk, r.speed, 'unconfirmed');
    v_new := v_new + 1;
  end loop;

  insert into public.import_runs (tile, ok_at, last_try, rows_new) values (p_city, now(), now(), v_new)
  on conflict (tile) do update set ok_at = now(), rows_new = excluded.rows_new;
  return v_new;
end $$;

revoke execute on function public.osm_import_due(text), public.import_osm_obstacles(text, text)
  from public, anonymous, authenticated;
grant execute on function public.osm_import_due(text), public.import_osm_obstacles(text, text) to importador;

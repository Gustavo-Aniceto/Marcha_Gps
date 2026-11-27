-- Marcha GPS — o app vale pra todas as regiões (não só SP, Guarulhos e Itaquá).
-- 1) Região "geral" cobre o mundo todo: aviso do Radar e importação valem em qualquer lugar
--    (as 3 cidades antigas continuam com as caixas delas e ganham na prioridade).
-- 2) Equipe pode ser de qualquer cidade: o pedido manda o nome da cidade e o banco cria a cidade.
-- 3) Importação do OpenStreetMap segue onde a galera anda: quadrados de 0,2° (~22 km) marcados pelo app.

-- 1) cidades sem caixa (só nome) + região geral
alter table public.cities alter column lat_min drop not null, alter column lat_max drop not null,
                          alter column lon_min drop not null, alter column lon_max drop not null;
insert into public.cities (id, name, priority, lat_min, lat_max, lon_min, lon_max)
values ('geral', 'Outras cidades', 99, -90, 90, -180, 180) on conflict (id) do nothing;

-- 2) pedido de equipe com cidade livre
alter table public.crew_requests add column city_name text;

create or replace function public.city_slug(p_name text)
returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(lower(translate(btrim(p_name),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '_', 'g'), '_'), '');
$$;

create or replace function public.trg_crew_request_city()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(regexp_replace(coalesce(new.city_name, ''), '\s+', ' ', 'g'));
        v_id text;
begin
  if v_name <> '' then
    if length(v_name) not between 2 and 60 or v_name !~ '[[:alpha:]]' then raise exception 'cidade_invalida'; end if;
    v_id := left(public.city_slug(v_name), 60);
    if v_id is null then raise exception 'cidade_invalida'; end if;
    insert into public.cities (id, name, priority) values (v_id, v_name, 50) on conflict (id) do nothing;
    new.city_id := v_id;
    new.city_name := v_name;
  end if;
  if new.city_id is null then raise exception 'cidade_invalida'; end if;
  return new;
end $$;
create trigger crew_request_city before insert on public.crew_requests
  for each row execute function public.trg_crew_request_city();

-- 3) importação onde a galera anda
alter table public.import_runs add column if not exists wanted_at timestamptz;

-- id do quadrado: g<linha>_<coluna> (0,2° cada; linha a partir de -90, coluna a partir de -180)
create or replace function public.area_cell(p_lat double precision, p_lon double precision)
returns text language sql immutable as $$
  select 'g' || floor((p_lat + 90) * 5)::int || '_' || floor((p_lon + 180) * 5)::int;
$$;

-- O app marca os lugares por onde a pessoa anda/vai (posição e pontos da rota). Até 40 pontos por chamada.
create or replace function public.mark_areas(p_lats double precision[], p_lons double precision[])
returns integer language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile(); v_n integer;
begin
  if coalesce(array_length(p_lats, 1), 0) <> coalesce(array_length(p_lons, 1), 0) then raise exception 'invalid_points'; end if;
  if coalesce(array_length(p_lats, 1), 0) > 40 then raise exception 'too_many_points'; end if;
  with c as (
    select distinct public.area_cell(la, lo) as tile
      from unnest(p_lats, p_lons) as t(la, lo)
     where la between -60 and 15 and lo between -90 and -30   -- América do Sul (onde o app é usado)
  ), up as (
    insert into public.import_runs (tile, wanted_at) select tile, now() from c
    on conflict (tile) do update set wanted_at = now()
      where public.import_runs.wanted_at is null or public.import_runs.wanted_at < now() - interval '1 day'
    returning 1
  ) select count(*) into v_n from up;
  return v_n;
end $$;
revoke execute on function public.mark_areas(double precision[], double precision[]) from public, anonymous;
grant execute on function public.mark_areas(double precision[], double precision[]) to authenticated;

-- Quadrados pedidos nos últimos 30 dias que estão vencidos (nunca importados ou há mais de 6 dias).
create or replace function public.osm_cells_due(p_limit integer default 3)
returns setof text language sql stable security definer set search_path = public as $$
  select tile from public.import_runs
   where tile ~ '^g[0-9]+_[0-9]+$' and wanted_at > now() - interval '30 days'
     and (ok_at is null or ok_at < now() - interval '6 days')
     and (last_try is null or last_try < now() - interval '50 minutes')
   order by ok_at nulls first, wanted_at desc
   limit least(greatest(p_limit, 1), 10);
$$;
revoke execute on function public.osm_cells_due(integer) from public, anonymous, authenticated;
grant execute on function public.osm_cells_due(integer) to importador;

create or replace function public.osm_import_due(p_tile text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_due boolean;
begin
  if p_tile !~ '^[a-z0-9_]{1,30}$' then raise exception 'faixa_invalida'; end if;
  insert into public.import_runs (tile) values (p_tile) on conflict do nothing;
  update public.import_runs
     set last_try = now()
   where tile = p_tile
     and (ok_at is null or ok_at < now() - interval '6 days')
     and (last_try is null or last_try < now() - interval '50 minutes')
  returning true into v_due;
  return coalesce(v_due, false);
end $$;

create or replace function public.import_osm_obstacles(p_city text, p_csv text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r       record;
  v_city  text;
  v_new   integer := 0;
  v_force text := (select id from public.cities where id = p_city and lat_min is not null and id <> 'geral');
begin
  if p_city !~ '^[a-z0-9_]{1,30}$' then raise exception 'faixa_invalida'; end if;
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

-- Marcha GPS — radares das fontes oficiais (dados abertos), com velocidade da placa:
--   cet  = CET-SP (cidade de São Paulo), Base_Locais_Fiscalizados.csv, licença CC-BY 4.0
--   der  = DER-SP (rodovias estaduais), radares.xml da página "Pesquisa de Radares"
--   antt = ANTT (rodovias federais concedidas: Dutra, Fernão Dias...), dataset "radar"
-- O serviço (marcha-gps-api) baixa o arquivo uma vez por semana e manda o texto cru pra cá; o banco
-- lê, filtra as 3 cidades, cria/atualiza e tira do mapa o que a fonte desativou. Radar oficial já
-- entra confirmado (sem autor, então não dá ponto pra ninguém). Radar do OpenStreetMap a menos de
-- 30 m de um oficial sai do mapa (duplicado).

alter table public.reports drop constraint reports_source_check;
alter table public.reports add constraint reports_source_check
  check (source in ('user', 'osm', 'antt', 'cet', 'der'));
alter table public.reports add column label text check (label is null or length(label) <= 200);

-- "080/080 km/h", "50 km/h", "60" -> 80, 50, 60 (a primeira é a de carro). Fora de 20..130 = sem velocidade.
create or replace function public.parse_speed(p text)
returns integer language sql immutable as $$
  select case when n between 20 and 130 then n end
    from (select nullif(substring(coalesce(p, '') from '([0-9]{2,3})'), '')::integer as n) x;
$$;

-- nome do município como as fontes escrevem -> id da cidade
create or replace function public.city_by_name(p text)
returns text language sql immutable as $$
  select case upper(translate(btrim(coalesce(p, '')), 'ãÃáÁ', 'aAaA'))
           when 'SAO PAULO' then 'sao_paulo' when 'GUARULHOS' then 'guarulhos'
           when 'ITAQUAQUECETUBA' then 'itaquaquecetuba' end;
$$;

create or replace function public.import_official_radars(p_source text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rows    jsonb := '[]';
  r         record;
  v_city    text;
  v_new     integer := 0;
  v_upd     integer := 0;
  v_gone    integer := 0;
  v_dups    integer := 0;
  v_active  integer;
  v_count   integer;
begin
  if p_source not in ('cet', 'der', 'antt') then raise exception 'fonte_invalida'; end if;
  if length(p_text) > 30000000 then raise exception 'arquivo_grande'; end if;

  -- 1) texto cru -> linhas {ref, lat, lon, speed, label}
  if p_source = 'cet' then
    -- CSV: só a descrição (5º campo) pode ter vírgula; os 4 primeiros e os 10 últimos não têm.
    with linhas as (
      select l from string_to_table(replace(p_text, E'\r', ''), E'\n') l where l ~ '^[0-9]'
    ), partes as (
      select string_to_array(l, ',') a from linhas
    ), campos as (
      select a[1] cod, a[3] desat,
             btrim(array_to_string(a[5:array_length(a, 1) - 10], ','), ' "') descr,
             a[array_length(a, 1) - 9] lat_t, a[array_length(a, 1) - 8] lon_t,
             a[array_length(a, 1) - 4] vel, a[array_length(a, 1)] enq
        from partes where array_length(a, 1) >= 15
    )
    select coalesce(jsonb_agg(jsonb_build_object('ref', 'cet/' || cod, 'lat', lat_t::double precision,
             'lon', lon_t::double precision, 'speed', public.parse_speed(vel), 'label', left(descr, 200), 'city', 'sao_paulo')), '[]')
      into v_rows
      from campos
     where btrim(desat) = '' and lat_t ~ '^-2[34]\.[0-9]+$' and lon_t ~ '^-4[67]\.[0-9]+$'
       and 'V' = any (string_to_array(replace(enq, ' ', ''), ';'));    -- só o que fiscaliza velocidade

  elsif p_source = 'der' then
    with itens as (
      select unnest(xpath('//radares', p_text::xml)) x
    ), campos as (
      select (xpath('/radares/RAD_CODIGO/text()', x))[1]::text cod, (xpath('/radares/Municipio/text()', x))[1]::text mun,
             (xpath('/radares/TipoRadar/text()', x))[1]::text tipo, (xpath('/radares/Latitude/text()', x))[1]::text lat_t,
             (xpath('/radares/Longitude/text()', x))[1]::text lon_t, (xpath('/radares/rad_vel_regul/text()', x))[1]::text vel,
             (xpath('/radares/Rodovia/text()', x))[1]::text rod, (xpath('/radares/Denominacao/text()', x))[1]::text den,
             (xpath('/radares/KmInicial/text()', x))[1]::text km, (xpath('/radares/Orientacao/text()', x))[1]::text sentido,
             (xpath('/radares/rad_ativo/text()', x))[1]::text ativo
        from itens
    )
    select coalesce(jsonb_agg(jsonb_build_object('ref', 'der/' || cod, 'lat', replace(lat_t, ',', '.')::double precision,
             'lon', replace(lon_t, ',', '.')::double precision, 'speed', public.parse_speed(vel),
             'label', left(concat_ws(' · ', rod || coalesce(' ' || den, ''), 'km ' || km, sentido), 200),
             'city', public.city_by_name(mun))), '[]')
      into v_rows
      from campos
     where mun in ('São Paulo', 'Guarulhos', 'Itaquaquecetuba') and tipo in ('Controlador', 'Redutor')
       and coalesce(ativo, 'Ativo') = 'Ativo'
       and replace(lat_t, ',', '.') ~ '^-2[34]\.[0-9]+$' and replace(lon_t, ',', '.') ~ '^-4[67]\.[0-9]+$';

  else
    -- ANTT: CSV com ";" e vírgula decimal, sem aspas.
    -- concessionaria;ano;tipo_de_radar;rodovia;uf;km_m;Municipio;tipo_de_pista;sentido;situacao;inativacao;latitude;longitude;vel_leve;vel_pesado
    with linhas as (
      select string_to_array(l, ';') a from string_to_table(replace(p_text, E'\r', ''), E'\n') l
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'ref', 'antt/' || a[4] || '/' || a[6] || '/' || a[9],
             'lat', replace(a[12], ',', '.')::double precision, 'lon', replace(a[13], ',', '.')::double precision,
             'speed', public.parse_speed(a[14]), 'label', left(a[4] || ' · km ' || a[6] || ' · ' || a[9], 200),
             'city', public.city_by_name(a[7]))), '[]')
      into v_rows
      from linhas
     where array_length(a, 1) >= 14 and a[5] = 'SP' and a[10] = 'Ativo'
       and upper(a[7]) in ('SÃO PAULO', 'SAO PAULO', 'GUARULHOS', 'ITAQUAQUECETUBA')
       and replace(a[12], ',', '.') ~ '^-2[34]\.[0-9]+$' and replace(a[13], ',', '.') ~ '^-4[67]\.[0-9]+$';
  end if;

  v_count := jsonb_array_length(v_rows);
  select count(*) into v_active from public.reports where source = p_source and status = 'confirmed';
  -- arquivo veio quebrado/vazio? não apaga o mapa por causa disso
  if v_count = 0 or (v_active >= 20 and v_count < v_active / 2) then
    raise exception 'lista_suspeita %/%', v_count, v_active;
  end if;

  -- 2) cria ou atualiza
  for r in select distinct on (x.ref) x.* from jsonb_to_recordset(v_rows)
             as x(ref text, lat double precision, lon double precision, speed integer, label text, city text) order by x.ref
  loop
    -- cidade pelo nome que a fonte dá (a divisa das caixas de city_for se sobrepõe); a posição ainda tem que cair na área
    continue when public.city_for(r.lat, r.lon) is null;
    v_city := coalesce(r.city, public.city_for(r.lat, r.lon));
    update public.reports
       set lat = r.lat, lon = r.lon, city_id = v_city, speed_limit = coalesce(r.speed, speed_limit), label = r.label,
           status = 'confirmed', confirmed_at = coalesce(confirmed_at, now()), expires_at = null
     where source = p_source and source_ref = r.ref;
    if found then v_upd := v_upd + 1;
    else
      insert into public.reports (kind, lat, lon, city_id, source, source_ref, base_risk, speed_limit, label, status, confirmed_at)
      values ('radar', r.lat, r.lon, v_city, p_source, r.ref, 0, r.speed, r.label, 'confirmed', now());
      v_new := v_new + 1;
    end if;
  end loop;

  -- 3) a fonte desativou: sai do mapa
  update public.reports set status = 'expired'
   where source = p_source and status in ('confirmed', 'unconfirmed')
     and source_ref not in (select x ->> 'ref' from jsonb_array_elements(v_rows) x);
  get diagnostics v_gone = row_count;

  -- 4) radar do OSM em cima de um oficial é o mesmo radar
  update public.reports o set status = 'expired'
   where o.source = 'osm' and o.kind = 'radar' and o.status in ('confirmed', 'unconfirmed')
     and exists (select 1 from public.reports f
                  where f.source in ('cet', 'der', 'antt') and f.status = 'confirmed'
                    and abs(f.lat - o.lat) < 0.0004 and abs(f.lon - o.lon) < 0.0004
                    and public.haversine_m(f.lat, f.lon, o.lat, o.lon) < 30);
  get diagnostics v_dups = row_count;

  insert into public.import_runs (tile, ok_at, last_try, rows_new) values ('oficial_' || p_source, now(), now(), v_new)
  on conflict (tile) do update set ok_at = now(), rows_new = excluded.rows_new;

  return jsonb_build_object('lidos', v_count, 'novos', v_new, 'atualizados', v_upd, 'desativados', v_gone,
                            'osm_duplicados', v_dups);
end $$;

revoke execute on function public.import_official_radars(text, text) from public, anonymous, authenticated;
grant execute on function public.import_official_radars(text, text) to importador;
grant execute on function public.parse_speed(text), public.city_by_name(text) to importador;

-- Marcha GPS — quem avisa um radar informa a velocidade dele (km/h).
-- create_report ganha p_speed_limit (opcional). Troca a função de 3 por uma de 4 parâmetros
-- (com padrão), senão a Data API ficaria com duas versões ambíguas.

drop function if exists public.create_report(text, double precision, double precision);

create or replace function public.create_report(p_kind text, p_lat double precision, p_lon double precision,
                                                p_speed_limit integer default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid   text := public.require_profile();
  v_city  text := public.city_for(p_lat, p_lon);
  v_id    uuid;
  v_speed integer;
begin
  if v_city is null then raise exception 'outside_area'; end if;
  -- velocidade só vale pra radar e só valores de placa (10 a 120, de 10 em 10)
  if p_speed_limit is not null and (p_kind <> 'radar' or p_speed_limit not between 10 and 120 or p_speed_limit % 10 <> 0) then
    raise exception 'invalid_speed';
  end if;
  v_speed := p_speed_limit;
  if (select count(*) from public.reports
       where author_id = v_uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited';
  end if;

  -- já existe o mesmo aviso a menos de 15 m: vira um voto "está lá"
  select id into v_id from public.reports
   where kind = p_kind and status in ('unconfirmed', 'confirmed')
     and (expires_at is null or expires_at > now())
     and abs(lat - p_lat) < 0.0005 and abs(lon - p_lon) < 0.0005
     and public.haversine_m(lat, lon, p_lat, p_lon) < 15
   order by public.haversine_m(lat, lon, p_lat, p_lon)
   limit 1;
  if v_id is not null then
    -- radar que veio sem velocidade (ex.: importado) ganha a velocidade informada
    if v_speed is not null then
      update public.reports set speed_limit = v_speed where id = v_id and speed_limit is null;
    end if;
    if (select author_id from public.reports where id = v_id) is distinct from v_uid then
      perform public.vote_report(v_id, true, null);
    end if;
    return v_id;
  end if;

  insert into public.reports (kind, lat, lon, city_id, source, author_id, base_risk, expires_at, speed_limit)
  values (p_kind, p_lat, p_lon, v_city, 'user', v_uid,
          case when p_kind in ('lombada', 'valeta', 'buraco', 'rampa') then 3
               when p_kind in ('radar', 'blitz') then 0 else 2 end,
          now() + public.report_ttl(p_kind), v_speed)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.create_report(text, double precision, double precision, integer) from public, anonymous;
grant execute on function public.create_report(text, double precision, double precision, integer) to authenticated;

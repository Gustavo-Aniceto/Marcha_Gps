-- Marcha GPS — o carro de cada um no mapa vem com o ano e a versão (FIPE), pra o desenho 3D
-- escolher o modelo certo (ex.: Gol quadrado x Gol G5). A regra de quem vê quem não muda.

create or replace function public.visible_cars(p_city text default null)
returns table (user_id text, username text, lat double precision, lon double precision,
               heading smallint, approximate boolean, same_crew boolean, car jsonb, updated_at timestamptz,
               crews uuid[])
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid       text := public.require_profile();
  v_viewer_ok boolean := public.can_view_scene(v_uid);
  r           record;
  v_lat       double precision;
  v_lon       double precision;
  v_approx    boolean;
  v_grid      constant double precision := 0.0045;  -- ~500 m
begin
  if not v_viewer_ok then return; end if;

  for r in
    select p.id, p.username, p.visibility, p.precise_for_scene, p.delay_minutes,
           l.lat, l.lon, l.heading, l.updated_at,
           array(select a.crew_id from public.crew_members a
                   join public.crew_members b on b.crew_id = a.crew_id
                   join public.crews c on c.id = a.crew_id
                  where a.user_id = p.id and b.user_id = v_uid
                    and a.status = 'verified' and b.status = 'verified' and c.status = 'active'
                    -- "só uma equipe": as outras equipes em comum não contam
                    and (p.visibility <> 'crew' or p.visibility_crew is null or a.crew_id = p.visibility_crew)
                  order by a.crew_id) as shared
      from public.profiles p
      join public.live_locations l on l.user_id = p.id
     where p.id <> v_uid
       and p.visibility <> 'ghost'
       and l.updated_at > now() - interval '10 minutes'
  loop
    -- zona privada sobre a posição real atual
    if exists (select 1 from public.private_zones z
                where z.user_id = r.id and public.haversine_m(z.lat, z.lon, r.lat, r.lon) <= z.radius_m) then
      continue;
    end if;

    if cardinality(r.shared) > 0 then
      v_lat := r.lat; v_lon := r.lon; v_approx := false;
    elsif r.visibility = 'scene' then
      if r.delay_minutes > 0 then
        select h.lat, h.lon into v_lat, v_lon
          from public.location_history h
         where h.user_id = r.id
           and h.recorded_at <= now() - make_interval(mins => r.delay_minutes)
           and h.recorded_at > now() - make_interval(mins => r.delay_minutes + 10)
         order by h.recorded_at desc limit 1;
        if not found then continue; end if;
        if exists (select 1 from public.private_zones z
                    where z.user_id = r.id and public.haversine_m(z.lat, z.lon, v_lat, v_lon) <= z.radius_m) then
          continue;
        end if;
      else
        v_lat := r.lat; v_lon := r.lon;
      end if;
      v_approx := not r.precise_for_scene;
      if v_approx then
        v_lat := round(v_lat / v_grid) * v_grid;
        v_lon := round(v_lon / v_grid) * v_grid;
      end if;
    else
      continue;
    end if;

    if p_city is not null and public.city_for(v_lat, v_lon) is distinct from p_city then
      continue;
    end if;

    user_id := r.id; username := r.username; lat := v_lat; lon := v_lon;
    heading := case when v_approx then null else r.heading end;
    approximate := v_approx; same_crew := cardinality(r.shared) > 0; crews := r.shared;
    updated_at := case when v_approx or (cardinality(r.shared) = 0 and r.delay_minutes > 0)
                       then date_trunc('minute', r.updated_at) else r.updated_at end;
    car := (select jsonb_build_object('make', c.make, 'model', c.model, 'color', c.color,
                                      'ride_height_cm', c.ride_height_cm, 'suspension', c.suspension,
                                      'rim', c.rim, 'wheel_position', c.wheel_position,
                                      'camber_deg', c.camber_deg, 'tint', c.tint,
                                      'spoiler', c.spoiler, 'neon', c.neon, 'body_type', c.body_type,
                                      'year', c.year, 'version', c.fipe_version)
              from public.cars c where c.owner_id = r.id and c.is_active);
    return next;
  end loop;
end $$;


revoke execute on function public.visible_cars(text) from public, anonymous;
grant execute on function public.visible_cars(text) to authenticated;


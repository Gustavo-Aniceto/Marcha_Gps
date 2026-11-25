-- Marcha GPS — vários carros, visibilidade por equipe, página da equipe e códigos de fundador fixos.
--
-- 1) Vários carros por pessoa (até 5). Só um fica "no mapa" (is_active). Carro novo entra fora do mapa se
--    já existe um no mapa; trocar é por set_active_car(). Apagou o do mapa, o mais recente assume.
-- 2) Quem vê meu carro: fantasma / todas as minhas equipes / UMA equipe / cena. visible_cars respeita
--    e devolve em quais equipes a pessoa está com você (pro filtro por equipe na Cena).
-- 3) Evento sem tipo obrigatório (entra como encontro).
-- 4) Quem já é dono de equipe não pede outra; um pedido em aberto por vez. O Adm Master também pode ter equipe.
-- 5) Página da equipe (crew_page) separada do perfil de quem fundou; equipes e garagem no perfil.
-- 6) Código de fundador não vence e fica ligado à equipe que nasceu dele (crews.founder_code);
--    o Adm Master vê a lista com master_founder_codes().

-- ---------------------------------------------------------------------------
-- 1) Carros
-- ---------------------------------------------------------------------------
create or replace function public.cars_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.cars where owner_id = new.owner_id) >= 5 then
    raise exception 'too_many_cars';
  end if;
  if new.is_active and exists (select 1 from public.cars where owner_id = new.owner_id and is_active) then
    new.is_active := false;
  end if;
  return new;
end $$;

create trigger cars_before_insert before insert on public.cars
  for each row execute function public.cars_before_insert();

create or replace function public.cars_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_active then
    update public.cars set is_active = true
     where id = (select id from public.cars where owner_id = old.owner_id order by updated_at desc limit 1);
  end if;
  return old;
end $$;

create trigger cars_after_delete after delete on public.cars
  for each row execute function public.cars_after_delete();

revoke execute on function public.cars_before_insert(), public.cars_after_delete() from public, anonymous;

create or replace function public.set_active_car(p_car uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  if not exists (select 1 from public.cars where id = p_car and owner_id = v_uid) then
    raise exception 'car_not_found';
  end if;
  update public.cars set is_active = false where owner_id = v_uid and is_active and id <> p_car;
  update public.cars set is_active = true where id = p_car;
end $$;

revoke execute on function public.set_active_car(uuid) from public, anonymous;
grant execute on function public.set_active_car(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Quem vê meu carro, por equipe
-- ---------------------------------------------------------------------------
alter table public.profiles add column visibility_crew uuid references public.crews (id) on delete set null;

create or replace function public.set_my_visibility(p_mode text, p_crew uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  if p_mode not in ('ghost', 'crew', 'scene') then raise exception 'invalid_visibility'; end if;
  if p_crew is not null then
    if p_mode <> 'crew' then raise exception 'invalid_visibility'; end if;
    if not public.is_crew_member(p_crew, v_uid) then raise exception 'forbidden'; end if;
  end if;
  update public.profiles set visibility = p_mode, visibility_crew = p_crew where id = v_uid;
end $$;

create or replace function public.my_visibility()
returns table (visibility text, visibility_crew uuid)
language sql stable security definer set search_path = public as $$
  select p.visibility, p.visibility_crew from public.profiles p where p.id = auth.user_id();
$$;

revoke execute on function public.set_my_visibility(text, uuid), public.my_visibility() from public, anonymous;
grant execute on function public.set_my_visibility(text, uuid), public.my_visibility() to authenticated;

-- visible_cars: mesma regra de antes + "só uma equipe" + em quais equipes vocês estão juntos
drop function public.visible_cars(text);
create function public.visible_cars(p_city text default null)
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
                                      'spoiler', c.spoiler, 'neon', c.neon, 'body_type', c.body_type)
              from public.cars c where c.owner_id = r.id and c.is_active);
    return next;
  end loop;
end $$;

revoke execute on function public.visible_cars(text) from public, anonymous;
grant execute on function public.visible_cars(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Evento: o tipo não é mais escolhido (entra como encontro)
-- ---------------------------------------------------------------------------
alter table public.events alter column kind set default 'encontro';

-- ---------------------------------------------------------------------------
-- 4) Pedido de equipe: dono de equipe não pede outra; um pedido em aberto por vez
-- ---------------------------------------------------------------------------
drop policy requests_insert on public.crew_requests;
create policy requests_insert on public.crew_requests for insert to authenticated
  with check (requester_id = auth.user_id() and public.has_profile() and status = 'pending'
              and reviewed_by is null and crew_id is null and master_note is null
              and not exists (select 1 from public.crew_members cm
                               where cm.user_id = auth.user_id() and cm.role = 'founder')
              and not exists (select 1 from public.crew_requests r
                               where r.requester_id = auth.user_id() and r.status in ('pending', 'more_info')));

-- ---------------------------------------------------------------------------
-- 6) Código de fundador fixo e ligado à equipe
-- ---------------------------------------------------------------------------
alter table public.crews add column founder_code text unique references public.invites (code) on delete set null;

-- códigos de fundador não vencem (os já criados também)
update public.invites set expires_at = 'infinity' where crew_id is null;

create or replace function public.create_invite(p_crew uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid  text := public.require_profile();
  v_code text;
begin
  if p_crew is null then
    if not public.is_master(v_uid) then raise exception 'forbidden'; end if;
  else
    if not exists (select 1 from public.crews where id = p_crew and status = 'active') then
      raise exception 'crew_not_active';
    end if;
    if not public.is_master(v_uid) then
      if not public.is_verified_in(p_crew, v_uid) then raise exception 'forbidden'; end if;
      update public.profiles set invites_left = invites_left - 1
       where id = v_uid and invites_left > 0;
      if not found then raise exception 'no_invites_left'; end if;
    end if;
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
                    substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    begin
      insert into public.invites (code, crew_id, created_by, expires_at)
      values (v_code, p_crew, v_uid, case when p_crew is null then 'infinity'::timestamptz else now() + interval '7 days' end);
      exit;
    exception when unique_violation then
      null; -- tenta outro código
    end;
  end loop;
  return v_code;
end $$;

create or replace function public.review_crew_request(p_request uuid, p_decision text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid  text := public.require_profile();
  v_req  public.crew_requests;
  v_crew uuid;
begin
  if not public.is_master(v_uid) then raise exception 'forbidden'; end if;
  if p_decision not in ('approved', 'rejected', 'more_info') then raise exception 'invalid_decision'; end if;

  select * into v_req from public.crew_requests where id = p_request for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.status in ('approved', 'rejected') then raise exception 'already_reviewed'; end if;

  if p_decision = 'approved' then
    insert into public.crews (name, city_id, instagram, founder_code)
    values (v_req.name, v_req.city_id, v_req.instagram,
            (select i.code from public.invites i
              where i.used_by = v_req.requester_id and i.crew_id is null
                and not exists (select 1 from public.crews x where x.founder_code = i.code)
              order by i.used_at limit 1))
    returning id into v_crew;
    insert into public.crew_members (crew_id, user_id, role, status, verified_at)
    values (v_crew, v_req.requester_id, 'founder', 'verified', now());
    update public.profiles set invites_left = invites_left + 5 where id = v_req.requester_id;
  end if;

  update public.crew_requests
     set status = p_decision, master_note = p_note, reviewed_by = v_uid, reviewed_at = now(), crew_id = v_crew
   where id = p_request;
  return v_crew;
end $$;

-- equipes que já existem: liga ao código de fundador de quem fundou
update public.crews c set founder_code = (
  select i.code from public.invites i
    join public.crew_members m on m.user_id = i.used_by and m.crew_id = c.id and m.role = 'founder'
   where i.crew_id is null order by i.used_at limit 1)
 where c.founder_code is null;

create or replace function public.master_founder_codes()
returns table (code text, created_at timestamptz, used_at timestamptz, used_by text,
               crew_id uuid, crew_name text, crew_status text, request_status text, request_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_master(public.require_profile()) then raise exception 'forbidden'; end if;
  return query
    select i.code, i.created_at, i.used_at, u.username,
           c.id, c.name, c.status,
           r.status, r.name
      from public.invites i
      left join public.profiles u on u.id = i.used_by
      left join public.crews c on c.founder_code = i.code
      left join lateral (select x.status, x.name from public.crew_requests x
                          where x.requester_id = i.used_by order by x.created_at desc limit 1) r on c.id is null
     where i.crew_id is null
     order by i.created_at;
end $$;

revoke execute on function public.master_founder_codes() from public, anonymous;
grant execute on function public.master_founder_codes() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Página da equipe, equipes e garagem no perfil
-- ---------------------------------------------------------------------------
create or replace function public.crew_page(p_crew uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v_out jsonb;
begin
  select jsonb_build_object(
           'id', c.id, 'name', c.name, 'city', ci.name, 'instagram', c.instagram,
           'color', c.color, 'button_shape', c.button_shape, 'created_at', c.created_at,
           'status', c.status,
           'founder', (select jsonb_build_object('username', p.username, 'avatar_key', p.avatar_key)
                         from public.crew_members m join public.profiles p on p.id = m.user_id
                        where m.crew_id = c.id and m.role = 'founder' limit 1),
           'members', coalesce((select jsonb_agg(jsonb_build_object('username', p.username, 'avatar_key', p.avatar_key,
                                                                    'role', m.role) order by
                                                   case m.role when 'founder' then 0 when 'admin' then 1 else 2 end, p.username)
                                  from public.crew_members m join public.profiles p on p.id = m.user_id
                                 where m.crew_id = c.id and m.status = 'verified'), '[]'::jsonb),
           'member_count', (select count(*) from public.crew_members m where m.crew_id = c.id and m.status = 'verified'),
           'i_am_member', public.is_crew_member(c.id, v_uid),
           'i_am_admin', public.is_crew_admin(c.id, v_uid),
           'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title,
                                                                   'starts_at', e.starts_at, 'ends_at', e.ends_at)
                                                order by e.starts_at)
                                 from public.events e
                                where e.crew_id = c.id and e.ends_at > now()
                                  and (public.is_crew_member(c.id, v_uid)
                                       or (e.visibility = 'open' and public.is_verified_anywhere(v_uid)))), '[]'::jsonb))
    into v_out
    from public.crews c join public.cities ci on ci.id = c.city_id
   where c.id = p_crew;
  return v_out;
end $$;

create or replace function public.profile_crews(p_username text)
returns table (crew_id uuid, name text, color text, role text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.color, m.role
    from public.profiles p
    join public.crew_members m on m.user_id = p.id and m.status = 'verified'
    join public.crews c on c.id = m.crew_id and c.status = 'active'
   where public.has_profile() and p.username = lower(trim(p_username))
   order by case m.role when 'founder' then 0 when 'admin' then 1 else 2 end, c.name;
$$;

create or replace function public.profile_garage(p_username text)
returns table (id uuid, make text, model text, year integer, color text, body_type text,
               tint text, spoiler boolean, neon text, is_active boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.make, c.model, c.year, c.color, c.body_type, c.tint, c.spoiler, c.neon, c.is_active
    from public.profiles p join public.cars c on c.owner_id = p.id
   where public.has_profile() and p.username = lower(trim(p_username))
   order by c.is_active desc, c.updated_at desc;
$$;

revoke execute on function public.crew_page(uuid), public.profile_crews(text), public.profile_garage(text)
  from public, anonymous;
grant execute on function public.crew_page(uuid), public.profile_crews(text), public.profile_garage(text)
  to authenticated;

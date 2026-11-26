-- Cargo "Staff" dentro da equipe: fica entre membro e admin; quem nomeia é o fundador.
-- Staff pode: criar eventos (e editar/apagar os que criou), aprovar/recusar quem pede pra entrar,
-- fazer o check-in de presença (QR) e editar a página da equipe (capa, foto, bio, Instagram).
-- Não pode: mudar cargos, mexer no tema da equipe, contestar mídia nem apagar post dos outros
-- (isso continua com fundador/admin via is_crew_admin()).

alter table public.crew_members drop constraint crew_members_role_check;
alter table public.crew_members add constraint crew_members_role_check
  check (role in ('founder', 'admin', 'staff', 'member'));

-- fundador, admin ou staff verificado
create or replace function public.is_crew_staff(p_crew uuid, p_uid text default auth.user_id())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew_members
                 where crew_id = p_crew and user_id = p_uid
                   and status = 'verified' and role in ('founder', 'admin', 'staff'));
$$;
revoke all on function public.is_crew_staff(uuid, text) from public;
grant execute on function public.is_crew_staff(uuid, text) to authenticated;

-- ---------- eventos: staff cria e cuida dos que criou ----------
drop policy if exists events_admin_write on public.events;
create policy events_admin_write on public.events for all to authenticated
  using (public.is_crew_admin(crew_id) or (public.is_crew_staff(crew_id) and created_by = auth.user_id()))
  with check (public.is_crew_staff(crew_id) and created_by = auth.user_id());

-- quem criou o evento (security definer pra policy de event_guest_crews não cair em recursão com a de events)
create or replace function public.event_creator(p_event uuid)
returns text language sql stable security definer set search_path = public as $$
  select created_by from public.events where id = p_event;
$$;
revoke all on function public.event_creator(uuid) from public;
grant execute on function public.event_creator(uuid) to authenticated;

drop policy if exists guests_admin_write on public.event_guest_crews;
create policy guests_admin_write on public.event_guest_crews for all to authenticated
  using (public.is_crew_admin(public.event_crew_id(event_id))
         or (public.is_crew_staff(public.event_crew_id(event_id))
             and public.event_creator(event_id) = auth.user_id()))
  with check (public.is_crew_admin(public.event_crew_id(event_id))
              or (public.is_crew_staff(public.event_crew_id(event_id))
                  and public.event_creator(event_id) = auth.user_id()));

-- ---------- pedidos pra entrar ----------
drop policy if exists join_requests_read on public.crew_join_requests;
create policy join_requests_read on public.crew_join_requests for select to authenticated
  using (user_id = auth.user_id() or public.is_crew_staff(crew_id));

create or replace function public.decide_join_request(p_request uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v_req public.crew_join_requests;
begin
  if p_decision not in ('approved', 'rejected') then raise exception 'invalid_decision'; end if;
  select * into v_req from public.crew_join_requests where id = p_request for update;
  if not found then raise exception 'request_not_found'; end if;
  if not public.is_crew_staff(v_req.crew_id, v_uid) then raise exception 'forbidden'; end if;
  if v_req.status <> 'pending' then raise exception 'already_reviewed'; end if;

  if p_decision = 'approved' then
    insert into public.crew_members (crew_id, user_id, role, status, sponsor_id)
    values (v_req.crew_id, v_req.user_id, 'member', 'pending', v_uid)
    on conflict (crew_id, user_id) do nothing;
  end if;
  update public.crew_join_requests set status = p_decision, decided_by = v_uid, decided_at = now()
   where id = p_request;
end $$;

create or replace function public.my_crews_join_requests()
returns table(id uuid, crew_id uuid, crew_name text, username text, avatar_key text, message text,
              created_at timestamptz, car text, crews_in integer)
language sql stable security definer set search_path = public as $$
  select r.id, r.crew_id, c.name, p.username, p.avatar_key, r.message, r.created_at,
         (select trim(coalesce(k.make, '') || ' ' || coalesce(k.model, '')) from public.cars k
           where k.owner_id = p.id order by k.is_active desc limit 1),
         (select count(*)::int from public.crew_members m where m.user_id = p.id and m.status = 'verified')
    from public.crew_join_requests r
    join public.crews c on c.id = r.crew_id
    join public.profiles p on p.id = r.user_id
   where r.status = 'pending' and public.is_crew_staff(r.crew_id, public.require_profile())
   order by r.created_at;
$$;

create or replace function public.trg_notify_join_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; v_crew text; v_user text;
begin
  select name into v_crew from public.crews where id = new.crew_id;
  select username into v_user from public.profiles where id = new.user_id;
  if tg_op = 'INSERT' then
    for a in select user_id from public.crew_members
              where crew_id = new.crew_id and role in ('founder', 'admin', 'staff') and status = 'verified' loop
      perform public.notify(a.user_id, 'pedido_entrar', 'equipes', '@' || v_user || ' quer entrar na ' || v_crew,
        coalesce(new.message, 'Toque pra aprovar ou recusar.'), '/equipes');
    end loop;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform public.notify(new.user_id, 'entrada_decidida', 'equipes',
      case when new.status = 'approved' then 'Você entrou na ' || v_crew || '!' else 'Seu pedido pra ' || v_crew || ' foi recusado' end,
      case when new.status = 'approved' then 'Agora a galera confirma que te conhece e alguém da staff faz o check-in num encontro.'
           else 'Dá pra pedir de novo depois de 7 dias.' end,
      '/equipe/' || new.crew_id);
  end if;
  return new;
end $$;

-- ---------- check-in de presença ----------
create or replace function public.admin_checkin(p_crew uuid, p_member text, p_event uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  if not public.is_crew_staff(p_crew, v_uid) then raise exception 'forbidden'; end if;
  if not public.is_crew_member(p_crew, p_member) then raise exception 'member_not_found'; end if;
  if p_event is not null and not exists (select 1 from public.events where id = p_event and crew_id = p_crew) then
    raise exception 'event_not_found';
  end if;
  insert into public.member_checkins (crew_id, member_id, admin_id, event_id)
  values (p_crew, p_member, v_uid, p_event);
  return public.try_verify(p_crew, p_member);
end $$;

-- ---------- página da equipe ----------
create or replace function public.set_crew_page(p_crew uuid, p_bio text, p_instagram text, p_avatar_key text, p_cover_key text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v_old public.crews;
  v_bio text := nullif(trim(coalesce(p_bio, '')), '');
  v_ig  text := nullif(regexp_replace(trim(coalesce(p_instagram, '')), '^@', ''), '');
begin
  select * into v_old from public.crews where id = p_crew for update;
  if not found then raise exception 'crew_not_found'; end if;
  if not public.is_crew_staff(p_crew, v_uid) then raise exception 'forbidden'; end if;
  if v_bio is not null and length(v_bio) > 600 then raise exception 'bio_too_long'; end if;
  if v_ig is not null and v_ig !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'invalid_instagram'; end if;
  if p_avatar_key is distinct from v_old.avatar_key and p_avatar_key is not null
     and not public.check_own_photo_key(p_avatar_key, v_uid) then raise exception 'invalid_photo'; end if;
  if p_cover_key is distinct from v_old.cover_key and p_cover_key is not null
     and not public.check_own_photo_key(p_cover_key, v_uid) then raise exception 'invalid_photo'; end if;

  update public.crews
     set bio = v_bio, instagram = v_ig, avatar_key = p_avatar_key, cover_key = p_cover_key
   where id = p_crew;
end $$;

create or replace function public.crew_page(p_crew uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v_admin boolean := public.is_crew_admin(p_crew, v_uid);
  v_staff boolean := public.is_crew_staff(p_crew, v_uid);
  v_role text := (select m.role from public.crew_members m
                   where m.crew_id = p_crew and m.user_id = v_uid and m.status = 'verified');
  v_out jsonb;
begin
  select jsonb_build_object(
           'id', c.id, 'name', c.name, 'city', ci.name, 'instagram', c.instagram,
           'color', c.color, 'button_shape', c.button_shape, 'created_at', c.created_at,
           'status', c.status, 'bio', c.bio, 'avatar_key', c.avatar_key, 'cover_key', c.cover_key,
           'founder', (select jsonb_build_object('username', p.username, 'avatar_key', p.avatar_key)
                         from public.crew_members m join public.profiles p on p.id = m.user_id
                        where m.crew_id = c.id and m.role = 'founder' limit 1),
           'members', coalesce((select jsonb_agg(jsonb_build_object('username', p.username, 'avatar_key', p.avatar_key,
                                                                    'role', m.role) order by
                                                   case m.role when 'founder' then 0 when 'admin' then 1 when 'staff' then 2 else 3 end, p.username)
                                  from public.crew_members m join public.profiles p on p.id = m.user_id
                                 where m.crew_id = c.id and m.status = 'verified'), '[]'::jsonb),
           'member_count', (select count(*) from public.crew_members m where m.crew_id = c.id and m.status = 'verified'),
           'i_am_member', public.is_crew_member(c.id, v_uid),
           'i_am_admin', v_admin,
           'i_am_staff', v_staff,
           'my_role', v_role,
           'my_request', (select r.status from public.crew_join_requests r
                           where r.crew_id = c.id and r.user_id = v_uid order by r.created_at desc limit 1),
           'join_requests', case when v_staff then coalesce((
               select jsonb_agg(jsonb_build_object('id', r.id, 'username', p.username, 'avatar_key', p.avatar_key,
                                                   'message', r.message, 'created_at', r.created_at) order by r.created_at)
                 from public.crew_join_requests r join public.profiles p on p.id = r.user_id
                where r.crew_id = c.id and r.status = 'pending'), '[]'::jsonb) else null end,
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
returns table(crew_id uuid, name text, color text, role text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.color, m.role
    from public.profiles p
    join public.crew_members m on m.user_id = p.id and m.status = 'verified'
    join public.crews c on c.id = m.crew_id and c.status = 'active'
   where public.has_profile() and p.username = lower(trim(p_username))
   order by case m.role when 'founder' then 0 when 'admin' then 1 when 'staff' then 2 else 3 end, c.name;
$$;

-- ---------- cargos: só o fundador (ou o master) muda; agora com staff ----------
create or replace function public.set_member_role(p_crew uuid, p_member text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  if not exists (select 1 from public.crew_members where crew_id = p_crew and user_id = v_uid
                   and role = 'founder' and status = 'verified')
     and not public.is_master(v_uid) then
    raise exception 'forbidden';
  end if;
  if p_role not in ('admin', 'staff', 'member') then raise exception 'invalid_role'; end if;
  update public.crew_members set role = p_role
   where crew_id = p_crew and user_id = p_member and role <> 'founder' and status = 'verified';
  if not found then raise exception 'member_not_found'; end if;
end $$;

-- Marcha GPS — página da equipe no jeito das páginas do Facebook (capa, foto, bio)
-- e convite que só dá acesso ao app: depois a pessoa pede pra entrar em cada equipe
-- e quem aprova é o fundador (ou admin) daquela equipe.

-- ---------------------------------------------------------------------------
-- 1) Página da equipe: capa, foto (logo) e bio
-- ---------------------------------------------------------------------------
alter table public.crews
  add column avatar_key text check (avatar_key is null or avatar_key ~ '^[a-z]+/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  add column cover_key  text check (cover_key  is null or cover_key  ~ '^[a-z]+/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  add column bio        text check (bio is null or length(bio) <= 600);

-- Fundador/admin edita. Foto nova tem que ser da própria pessoa; a que já estava pode ficar.
create or replace function public.set_crew_page(p_crew uuid, p_bio text, p_instagram text,
                                                p_avatar_key text, p_cover_key text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v_old public.crews;
  v_bio text := nullif(trim(coalesce(p_bio, '')), '');
  v_ig  text := nullif(regexp_replace(trim(coalesce(p_instagram, '')), '^@', ''), '');
begin
  select * into v_old from public.crews where id = p_crew for update;
  if not found then raise exception 'crew_not_found'; end if;
  if not public.is_crew_admin(p_crew, v_uid) then raise exception 'forbidden'; end if;
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

-- ---------------------------------------------------------------------------
-- 2) Convite: de fundador (registra equipe) ou de app (só entra no app)
-- ---------------------------------------------------------------------------
alter table public.invites add column kind text;
update public.invites set kind = case when crew_id is null then 'founder' else 'app' end;
alter table public.invites alter column kind set not null,
  add constraint invites_kind_check check (kind in ('founder', 'app'));

drop function public.create_invite(uuid);
create function public.create_invite(p_kind text default 'app')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid  text := public.require_profile();
  v_code text;
begin
  if p_kind = 'founder' then
    if not public.is_master(v_uid) then raise exception 'forbidden'; end if;
  elsif p_kind = 'app' then
    if not public.is_master(v_uid) then
      -- quem convida responde por quem entra: precisa estar verificado em alguma equipe
      if not public.is_verified_anywhere(v_uid) then raise exception 'forbidden'; end if;
      update public.profiles set invites_left = invites_left - 1
       where id = v_uid and invites_left > 0;
      if not found then raise exception 'no_invites_left'; end if;
    end if;
  else
    raise exception 'invalid_kind';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
                    substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    begin
      insert into public.invites (code, kind, crew_id, created_by, expires_at)
      values (v_code, p_kind, null, v_uid,
              case when p_kind = 'founder' then 'infinity'::timestamptz else now() + interval '7 days' end);
      exit;
    exception when unique_violation then
      null; -- tenta outro código
    end;
  end loop;
  return v_code;
end $$;

revoke execute on function public.create_invite(text) from public, anonymous;
grant execute on function public.create_invite(text) to authenticated;

-- Usar o convite só cria a conta no app. Nenhum convite coloca ninguém em equipe.
create or replace function public.redeem_invite(p_code text, p_username text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid text := auth.user_id();
  v_inv public.invites;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_inv from public.invites where code = upper(trim(p_code)) for update;
  if not found then raise exception 'invite_not_found'; end if;
  if v_inv.used_by is not null or v_inv.used_at is not null then raise exception 'invite_used'; end if;
  if v_inv.expires_at < now() then raise exception 'invite_expired'; end if;
  if v_inv.created_by = v_uid then raise exception 'own_invite'; end if;
  if public.has_profile(v_uid) then raise exception 'already_registered'; end if;
  if p_username is null then raise exception 'username_required'; end if;

  insert into public.profiles (id, username, invited_by)
  values (v_uid, lower(trim(p_username)), v_inv.created_by);

  update public.invites set used_by = v_uid, used_at = now() where code = v_inv.code;
  return null;
end $$;

create or replace function public.check_invite(p_code text)
returns table (status text, kind text, crew_name text)
language plpgsql stable security definer set search_path = public as $$
declare v public.invites;
begin
  if p_code is null or upper(trim(p_code)) !~ '^[0-9A-F]{4}-[0-9A-F]{4}$' then
    return query select 'nao_existe'::text, null::text, null::text; return;
  end if;
  select * into v from public.invites where code = upper(trim(p_code));
  if not found then return query select 'nao_existe'::text, null::text, null::text; return; end if;
  if v.used_by is not null or v.used_at is not null then return query select 'usado'::text, null::text, null::text; return; end if;
  if v.expires_at < now() then return query select 'vencido'::text, null::text, null::text; return; end if;
  return query select 'ok'::text, case when v.kind = 'founder' then 'fundador' else 'app' end, null::text;
end $$;

-- Só registra equipe quem entrou com código de fundador ainda sem equipe (ou o Adm Master)
create or replace function public.can_register_crew(p_uid text default auth.user_id())
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_master(p_uid) or exists (
    select 1 from public.invites i
     where i.used_by = p_uid and i.kind = 'founder'
       and not exists (select 1 from public.crews c where c.founder_code = i.code));
$$;
revoke execute on function public.can_register_crew(text) from public, anonymous;
grant execute on function public.can_register_crew(text) to authenticated;

drop policy requests_insert on public.crew_requests;
create policy requests_insert on public.crew_requests for insert to authenticated
  with check (requester_id = auth.user_id() and public.has_profile() and status = 'pending'
              and reviewed_by is null and crew_id is null and master_note is null
              and public.can_register_crew()
              and not exists (select 1 from public.crew_requests r
                               where r.requester_id = auth.user_id() and r.status in ('pending', 'more_info')));

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
              where i.used_by = v_req.requester_id and i.kind = 'founder'
                and not exists (select 1 from public.crews x where x.founder_code = i.code)
              order by i.used_at limit 1))
    returning id into v_crew;
    insert into public.crew_members (crew_id, user_id, role, status, verified_at)
    values (v_crew, v_req.requester_id, 'founder', 'verified', now())
    on conflict (crew_id, user_id) do nothing;
    update public.profiles set invites_left = invites_left + 5 where id = v_req.requester_id;
  end if;

  update public.crew_requests
     set status = p_decision, master_note = p_note, reviewed_by = v_uid, reviewed_at = now(), crew_id = v_crew
   where id = p_request;
  return v_crew;
end $$;

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
     where i.kind = 'founder'
     order by i.created_at;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Pedido pra entrar numa equipe; quem decide é o fundador/admin da equipe
-- ---------------------------------------------------------------------------
create table public.crew_join_requests (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews (id) on delete cascade,
  user_id     text not null references public.profiles (id) on delete cascade,
  message     text check (message is null or length(message) <= 300),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by  text references public.profiles (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
create unique index crew_join_requests_one_open on public.crew_join_requests (crew_id, user_id) where status = 'pending';
create index on public.crew_join_requests (user_id);

alter table public.crew_join_requests enable row level security;
create policy join_requests_read on public.crew_join_requests for select to authenticated
  using (user_id = auth.user_id() or public.is_crew_admin(crew_id));
grant select on public.crew_join_requests to authenticated;
-- escrita só pelas funções abaixo

create or replace function public.request_join_crew(p_crew uuid, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v_id  uuid;
  v_msg text := nullif(trim(coalesce(p_message, '')), '');
begin
  if not exists (select 1 from public.crews where id = p_crew and status = 'active') then
    raise exception 'crew_not_active';
  end if;
  if public.is_crew_member(p_crew, v_uid) then raise exception 'already_member'; end if;
  if exists (select 1 from public.crew_join_requests where crew_id = p_crew and user_id = v_uid and status = 'pending') then
    raise exception 'already_requested';
  end if;
  -- recusado há pouco: espera 7 dias pra pedir de novo
  if exists (select 1 from public.crew_join_requests where crew_id = p_crew and user_id = v_uid
               and status = 'rejected' and decided_at > now() - interval '7 days') then
    raise exception 'recently_rejected';
  end if;
  if v_msg is not null and length(v_msg) > 300 then raise exception 'message_too_long'; end if;
  insert into public.crew_join_requests (crew_id, user_id, message) values (p_crew, v_uid, v_msg)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_join_request(p_crew uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  update public.crew_join_requests set status = 'cancelled', decided_at = now()
   where crew_id = p_crew and user_id = v_uid and status = 'pending';
end $$;

-- Aprovou: entra como membro em verificação (padrinho = quem aprovou).
-- Depois segue a verificação de sempre: confirmações dos membros + check-in num encontro.
create or replace function public.decide_join_request(p_request uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v_req public.crew_join_requests;
begin
  if p_decision not in ('approved', 'rejected') then raise exception 'invalid_decision'; end if;
  select * into v_req from public.crew_join_requests where id = p_request for update;
  if not found then raise exception 'request_not_found'; end if;
  if not public.is_crew_admin(v_req.crew_id, v_uid) then raise exception 'forbidden'; end if;
  if v_req.status <> 'pending' then raise exception 'already_reviewed'; end if;

  if p_decision = 'approved' then
    insert into public.crew_members (crew_id, user_id, role, status, sponsor_id)
    values (v_req.crew_id, v_req.user_id, 'member', 'pending', v_uid)
    on conflict (crew_id, user_id) do nothing;
  end if;
  update public.crew_join_requests set status = p_decision, decided_by = v_uid, decided_at = now()
   where id = p_request;
end $$;

-- Pedidos esperando nas equipes em que sou fundador/admin
create or replace function public.my_crews_join_requests()
returns table (id uuid, crew_id uuid, crew_name text, username text, avatar_key text,
               message text, created_at timestamptz, car text, crews_in integer)
language sql stable security definer set search_path = public as $$
  select r.id, r.crew_id, c.name, p.username, p.avatar_key, r.message, r.created_at,
         (select trim(coalesce(k.make, '') || ' ' || coalesce(k.model, '')) from public.cars k
           where k.owner_id = p.id order by k.is_active desc limit 1),
         (select count(*)::int from public.crew_members m where m.user_id = p.id and m.status = 'verified')
    from public.crew_join_requests r
    join public.crews c on c.id = r.crew_id
    join public.profiles p on p.id = r.user_id
   where r.status = 'pending' and public.is_crew_admin(r.crew_id, public.require_profile())
   order by r.created_at;
$$;

-- Lista de equipes pra encontrar e pedir pra entrar
create or replace function public.crew_directory()
returns table (id uuid, name text, city text, color text, avatar_key text, member_count integer,
               i_am_member boolean, my_request text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, ci.name, c.color, c.avatar_key,
         (select count(*)::int from public.crew_members m where m.crew_id = c.id and m.status = 'verified'),
         public.is_crew_member(c.id, public.require_profile()),
         (select r.status from public.crew_join_requests r
           where r.crew_id = c.id and r.user_id = auth.user_id() order by r.created_at desc limit 1)
    from public.crews c join public.cities ci on ci.id = c.city_id
   where c.status = 'active'
   order by c.name;
$$;

-- crew_page ganha capa, foto, bio, meu pedido e (pra admin) os pedidos esperando
create or replace function public.crew_page(p_crew uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v_admin boolean := public.is_crew_admin(p_crew, v_uid);
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
                                                   case m.role when 'founder' then 0 when 'admin' then 1 else 2 end, p.username)
                                  from public.crew_members m join public.profiles p on p.id = m.user_id
                                 where m.crew_id = c.id and m.status = 'verified'), '[]'::jsonb),
           'member_count', (select count(*) from public.crew_members m where m.crew_id = c.id and m.status = 'verified'),
           'i_am_member', public.is_crew_member(c.id, v_uid),
           'i_am_admin', v_admin,
           'my_request', (select r.status from public.crew_join_requests r
                           where r.crew_id = c.id and r.user_id = v_uid order by r.created_at desc limit 1),
           'join_requests', case when v_admin then coalesce((
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

revoke execute on function public.set_crew_page(uuid, text, text, text, text), public.request_join_crew(uuid, text),
  public.cancel_join_request(uuid), public.decide_join_request(uuid, text), public.my_crews_join_requests(),
  public.crew_directory() from public, anonymous;
grant execute on function public.set_crew_page(uuid, text, text, text, text), public.request_join_crew(uuid, text),
  public.cancel_join_request(uuid), public.decide_join_request(uuid, text), public.my_crews_join_requests(),
  public.crew_directory() to authenticated;

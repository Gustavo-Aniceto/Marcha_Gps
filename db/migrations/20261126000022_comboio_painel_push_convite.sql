-- 1) Comboio: fundador/admin/staff começa um rolê com destino; membros verificados da equipe entram;
--    quem está no comboio vê os outros do comboio no mapa (entrar = aceitar mostrar a posição pra eles
--    enquanto o comboio durar, mesmo no modo fantasma). Zonas privadas e bloqueio continuam valendo.
--    Nada de velocidade nem disputa: o app só mostra quem está junto, na frente ou ficou pra trás.
-- 2) Painel de números pro Adm Master (master_stats) e "visto por último" (mark_seen).
-- 3) Notificação com o app fechado (Web Push): inscrições por aparelho; o marcha-gps-api (usuário
--    importador) pega as notificações novas a cada minuto e manda.
-- 4) Prévia do convite (invite_preview) pra página de compartilhar o link.

-- ---------------------------------------------------------------------------
-- 1) Comboio
-- ---------------------------------------------------------------------------
create table public.convoys (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews (id) on delete cascade,
  created_by  text not null references public.profiles (id) on delete cascade,
  title       text not null check (length(title) between 2 and 60),
  dest_lat    double precision not null check (dest_lat between -90 and 90),
  dest_lon    double precision not null check (dest_lon between -180 and 180),
  dest_name   text check (dest_name is null or length(dest_name) <= 120),
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index on public.convoys (crew_id, created_at desc);

create table public.convoy_members (
  convoy_id  uuid not null references public.convoys (id) on delete cascade,
  user_id    text not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  primary key (convoy_id, user_id)
);
create index on public.convoy_members (user_id);

alter table public.convoys enable row level security;
alter table public.convoy_members enable row level security;
-- leitura direta só do que é da sua equipe / seu; escrita só pelas funções abaixo
grant select on public.convoys, public.convoy_members to authenticated;
create policy convoys_read on public.convoys for select to authenticated
  using (public.is_crew_member(crew_id));
create policy convoy_members_read on public.convoy_members for select to authenticated
  using (user_id = auth.user_id());

-- comboio vale até ser encerrado ou por 12 h
create or replace function public.convoy_active(c public.convoys)
returns boolean language sql stable as $$
  select c.ended_at is null and c.created_at > now() - interval '12 hours';
$$;

create or replace function public.create_convoy(p_crew uuid, p_title text, p_dest_lat double precision,
                                                p_dest_lon double precision, p_dest_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v_id uuid;
  v_crew text;
  v_user text;
  m record;
begin
  if not public.is_crew_staff(p_crew, v_uid) then raise exception 'forbidden'; end if;
  if p_dest_lat is null or p_dest_lon is null or p_dest_lat not between -90 and 90 or p_dest_lon not between -180 and 180 then
    raise exception 'invalid_destination';
  end if;
  -- no máximo 3 comboios abertos por equipe ao mesmo tempo
  if (select count(*) from public.convoys c where c.crew_id = p_crew and public.convoy_active(c)) >= 3 then
    raise exception 'too_many_convoys';
  end if;
  insert into public.convoys (crew_id, created_by, title, dest_lat, dest_lon, dest_name)
  values (p_crew, v_uid, trim(p_title), p_dest_lat, p_dest_lon, nullif(trim(coalesce(p_dest_name, '')), ''))
  returning id into v_id;
  insert into public.convoy_members (convoy_id, user_id) values (v_id, v_uid);

  select name into v_crew from public.crews where id = p_crew;
  select username into v_user from public.profiles where id = v_uid;
  for m in select user_id from public.crew_members
            where crew_id = p_crew and status = 'verified' and user_id <> v_uid loop
    perform public.notify(m.user_id, 'comboio', 'eventos', 'Comboio saindo: ' || trim(p_title),
      '@' || v_user || ' começou um comboio da ' || v_crew ||
        coalesce(' pra ' || nullif(trim(coalesce(p_dest_name, '')), ''), '') || '. Toque pra entrar.',
      '/comboio/' || v_id);
  end loop;
  return v_id;
end $$;

create or replace function public.join_convoy(p_convoy uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile(); v public.convoys;
begin
  select * into v from public.convoys where id = p_convoy;
  if not found then raise exception 'convoy_not_found'; end if;
  if not public.convoy_active(v) then raise exception 'convoy_ended'; end if;
  if not exists (select 1 from public.crew_members where crew_id = v.crew_id and user_id = v_uid and status = 'verified') then
    raise exception 'forbidden';
  end if;
  insert into public.convoy_members (convoy_id, user_id) values (p_convoy, v_uid)
  on conflict (convoy_id, user_id) do update set left_at = null, joined_at = now();
end $$;

create or replace function public.leave_convoy(p_convoy uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.convoy_members set left_at = now()
   where convoy_id = p_convoy and user_id = public.require_profile() and left_at is null;
end $$;

-- quem começou, ou fundador/admin da equipe, encerra
create or replace function public.end_convoy(p_convoy uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile(); v public.convoys;
begin
  select * into v from public.convoys where id = p_convoy for update;
  if not found then raise exception 'convoy_not_found'; end if;
  if v.created_by <> v_uid and not public.is_crew_admin(v.crew_id, v_uid) then raise exception 'forbidden'; end if;
  update public.convoys set ended_at = coalesce(ended_at, now()) where id = p_convoy;
end $$;

-- comboios abertos das minhas equipes
create or replace function public.my_convoys()
returns table (id uuid, crew_id uuid, crew_name text, crew_color text, title text, dest_name text,
               dest_lat double precision, dest_lon double precision, created_at timestamptz,
               created_by text, members integer, joined boolean, can_end boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.crew_id, k.name, k.color, c.title, c.dest_name, c.dest_lat, c.dest_lon, c.created_at,
         (select username from public.profiles where id = c.created_by),
         (select count(*)::int from public.convoy_members m where m.convoy_id = c.id and m.left_at is null),
         exists (select 1 from public.convoy_members m where m.convoy_id = c.id and m.user_id = public.current_uid() and m.left_at is null),
         c.created_by = public.current_uid() or public.is_crew_admin(c.crew_id, public.current_uid())
    from public.convoys c join public.crews k on k.id = c.crew_id
   where public.convoy_active(c)
     and exists (select 1 from public.crew_members cm where cm.crew_id = c.crew_id
                   and cm.user_id = public.current_uid() and cm.status = 'verified')
   order by c.created_at desc;
$$;

-- estado do comboio: só quem está dentro vê as posições dos outros de dentro
create or replace function public.convoy_state(p_convoy uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v public.convoys;
  v_in boolean;
begin
  select * into v from public.convoys where id = p_convoy;
  if not found then raise exception 'convoy_not_found'; end if;
  if not exists (select 1 from public.crew_members where crew_id = v.crew_id and user_id = v_uid and status = 'verified')
     and not public.is_master(v_uid) then
    raise exception 'forbidden';
  end if;
  v_in := exists (select 1 from public.convoy_members m where m.convoy_id = v.id and m.user_id = v_uid and m.left_at is null);
  return jsonb_build_object(
    'id', v.id, 'crew_id', v.crew_id, 'title', v.title, 'dest_lat', v.dest_lat, 'dest_lon', v.dest_lon,
    'dest_name', v.dest_name, 'created_at', v.created_at, 'ended_at', v.ended_at, 'active', public.convoy_active(v),
    'crew_name', (select name from public.crews where id = v.crew_id),
    'crew_color', (select color from public.crews where id = v.crew_id),
    'created_by', (select username from public.profiles where id = v.created_by),
    'joined', v_in,
    'can_end', v.created_by = v_uid or public.is_crew_admin(v.crew_id, v_uid),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'username', p.username, 'avatar_key', p.avatar_key, 'me', p.id = v_uid,
               -- posição: só pra quem está no comboio, nunca dentro de zona privada, nunca com bloqueio
               'lat', case when v_in and l.updated_at > now() - interval '10 minutes'
                            and not exists (select 1 from public.private_zones z where z.user_id = p.id
                                             and public.haversine_m(z.lat, z.lon, l.lat, l.lon) <= z.radius_m)
                           then l.lat end,
               'lon', case when v_in and l.updated_at > now() - interval '10 minutes'
                            and not exists (select 1 from public.private_zones z where z.user_id = p.id
                                             and public.haversine_m(z.lat, z.lon, l.lat, l.lon) <= z.radius_m)
                           then l.lon end,
               'heading', case when v_in then l.heading end,
               'updated_at', case when v_in then l.updated_at end,
               'car', (select jsonb_build_object('make', c.make, 'model', c.model, 'color', c.color,
                                                 'body_type', c.body_type, 'tint', c.tint, 'spoiler', c.spoiler,
                                                 'ride_height_cm', c.ride_height_cm, 'rim', c.rim, 'camber_deg', c.camber_deg,
                                                 'neon', c.neon, 'year', c.year, 'version', c.fipe_version)
                         from public.cars c where c.owner_id = p.id and c.is_active limit 1))
             order by m.joined_at)
        from public.convoy_members m
        join public.profiles p on p.id = m.user_id
        left join public.live_locations l on l.user_id = p.id
       where m.convoy_id = v.id and m.left_at is null
         and (p.id = v_uid or not public.blocked_with(p.id, v_uid))), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 2) Painel de números (Adm Master)
-- ---------------------------------------------------------------------------
alter table public.profiles add column last_seen_at timestamptz;
create index on public.profiles (last_seen_at);

-- o app chama ao abrir; grava no máximo a cada 30 min
create or replace function public.mark_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now()
   where id = public.current_uid() and (last_seen_at is null or last_seen_at < now() - interval '30 minutes');
$$;

create or replace function public.master_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_master(public.require_profile()) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'people', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
      'new_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
      'active_1d', (select count(*) from public.profiles where last_seen_at > now() - interval '1 day'),
      'active_7d', (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
      'active_30d', (select count(*) from public.profiles where last_seen_at > now() - interval '30 days'),
      'on_map_now', (select count(*) from public.live_locations where updated_at > now() - interval '10 minutes'),
      'verified', (select count(distinct user_id) from public.crew_members where status = 'verified'),
      'with_car', (select count(distinct owner_id) from public.cars),
      'push', (select count(distinct user_id) from public.push_subscriptions)),
    'signups_14d', coalesce((select jsonb_agg(jsonb_build_object('day', d::date, 'n',
                                (select count(*) from public.profiles p where p.created_at >= d and p.created_at < d + interval '1 day'))
                                order by d)
                               from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d), '[]'),
    'crews', jsonb_build_object(
      'active', (select count(*) from public.crews where status = 'active'),
      'pending_requests', (select count(*) from public.crew_requests where status in ('pending', 'more_info'))),
    'radar', jsonb_build_object(
      'reports_7d', (select count(*) from public.reports where source = 'user' and created_at > now() - interval '7 days'),
      'confirmed_7d', (select count(*) from public.reports where source = 'user' and confirmed_at > now() - interval '7 days'),
      'active_total', (select count(*) from public.reports where status in ('unconfirmed', 'confirmed')
                                                         and (expires_at is null or expires_at > now()))),
    'social', jsonb_build_object(
      'posts_7d', (select count(*) from public.posts where created_at > now() - interval '7 days'),
      'comments_7d', (select count(*) from public.post_comments where created_at > now() - interval '7 days'),
      'events_upcoming', (select count(*) from public.events where ends_at > now()),
      'convoys_7d', (select count(*) from public.convoys where created_at > now() - interval '7 days'),
      'open_reports', (select count(*) from public.content_reports where status = 'open')),
    -- equipes mais ativas nos últimos 30 dias (posts + eventos + check-ins + comboios + gente nova)
    'top_crews', coalesce((select jsonb_agg(x order by (x->>'score')::int desc) from (
        select jsonb_build_object(
                 'id', c.id, 'name', c.name, 'color', c.color,
                 'members', (select count(*) from public.crew_members m where m.crew_id = c.id and m.status = 'verified'),
                 'posts', s.posts, 'events', s.events, 'checkins', s.checkins, 'convoys', s.convoys, 'joins', s.joins,
                 'score', s.posts + 3 * s.events + 2 * s.checkins + 3 * s.convoys + 2 * s.joins) as x
          from public.crews c
          cross join lateral (select
              (select count(*)::int from public.posts p where p.crew_id = c.id and p.created_at > now() - interval '30 days') as posts,
              (select count(*)::int from public.events e where e.crew_id = c.id and e.created_at > now() - interval '30 days') as events,
              (select count(*)::int from public.member_checkins k where k.crew_id = c.id and k.created_at > now() - interval '30 days') as checkins,
              (select count(*)::int from public.convoys v where v.crew_id = c.id and v.created_at > now() - interval '30 days') as convoys,
              (select count(*)::int from public.crew_join_requests r where r.crew_id = c.id and r.status = 'approved'
                                                                   and r.decided_at > now() - interval '30 days') as joins) s
         where c.status = 'active'
         order by s.posts + 3 * s.events + 2 * s.checkins + 3 * s.convoys + 2 * s.joins desc, c.name
         limit 10) t), '[]'),
    'at', now());
end $$;

-- ---------------------------------------------------------------------------
-- 3) Notificação com o app fechado (Web Push)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh      text not null check (length(p256dh) between 40 and 200),
  auth        text not null check (length(auth) between 10 and 60),
  user_agent  text check (user_agent is null or length(user_agent) <= 300),
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz,
  fails       integer not null default 0
);
create index on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
grant select on public.push_subscriptions to authenticated;
create policy push_own on public.push_subscriptions for select to authenticated using (user_id = auth.user_id());

alter table public.notifications add column pushed_at timestamptz;
-- as que já existiam não vão pro celular
update public.notifications set pushed_at = now();
create index on public.notifications (created_at) where pushed_at is null;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  if (select count(*) from public.push_subscriptions where user_id = v_uid and endpoint <> p_endpoint) >= 5 then
    -- no máximo 5 aparelhos: sai o mais antigo
    delete from public.push_subscriptions where id = (select id from public.push_subscriptions
                                                       where user_id = v_uid order by created_at limit 1);
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update set user_id = v_uid, p256dh = excluded.p256dh, auth = excluded.auth,
                                       user_agent = excluded.user_agent, fails = 0;
end $$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = public.current_uid();
$$;

-- marcha-gps-api (importador): pega as notificações novas (até 30 min) que ainda não foram pro celular
-- e marca como enviadas; devolve uma linha por aparelho.
create or replace function public.take_push_batch(p_limit integer default 40)
returns table (sub_id uuid, endpoint text, p256dh text, auth text, title text, body text, link text, notification_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with picked as (
    update public.notifications n set pushed_at = now()
     where n.id in (select id from public.notifications
                     where pushed_at is null and created_at > now() - interval '30 minutes'
                     order by created_at limit least(greatest(p_limit, 1), 200)
                     for update skip locked)
    returning n.id, n.user_id, n.title, n.body, n.link)
  select s.id, s.endpoint, s.p256dh, s.auth, p.title, p.body, p.link, p.id
    from picked p join public.push_subscriptions s on s.user_id = p.user_id;
  -- as que passaram de 30 min sem ir (serviço fora) não vão mais: aviso velho no celular só atrapalha
  update public.notifications set pushed_at = now()
   where pushed_at is null and created_at <= now() - interval '30 minutes';
end $$;

-- resultado do envio: 404/410 = aparelho saiu (apaga); outras falhas contam e apagam depois de 10
create or replace function public.push_result(p_sub uuid, p_ok boolean, p_gone boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_gone then delete from public.push_subscriptions where id = p_sub; return; end if;
  if p_ok then update public.push_subscriptions set last_ok_at = now(), fails = 0 where id = p_sub;
  else
    update public.push_subscriptions set fails = fails + 1 where id = p_sub;
    delete from public.push_subscriptions where id = p_sub and fails >= 10;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Prévia do convite (página de compartilhar; marcha-gps-api, sem login)
-- ---------------------------------------------------------------------------
create or replace function public.invite_preview(p_code text)
returns table (status text, kind text, inviter text, inviter_name text, inviter_avatar text, crew_name text)
language plpgsql stable security definer set search_path = public as $$
declare v public.invites; v_status text;
begin
  if p_code is null or upper(trim(p_code)) !~ '^[0-9A-F]{4}-[0-9A-F]{4}$' then
    return query select 'nao_existe'::text, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  select * into v from public.invites where code = upper(trim(p_code));
  if not found then
    return query select 'nao_existe'::text, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  v_status := case when v.used_by is not null or v.used_at is not null then 'usado'
                   when v.expires_at < now() then 'vencido' else 'ok' end;
  return query
  select v_status, case when v.kind = 'founder' then 'fundador' else 'app' end,
         -- convite de fundador vem do Adm Master: não mostra quem é (o master fica discreto)
         case when v.kind = 'founder' then null else p.username end,
         case when v.kind = 'founder' then null else p.display_name end,
         case when v.kind = 'founder' then null else p.avatar_key end,
         case when v.kind = 'founder' then null else
           (select c.name from public.crew_members m join public.crews c on c.id = m.crew_id
             where m.user_id = v.created_by and m.status = 'verified' and c.status = 'active'
             order by case m.role when 'founder' then 0 when 'admin' then 1 when 'staff' then 2 else 3 end, m.joined_at limit 1) end
    from public.profiles p where p.id = v.created_by;
end $$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
revoke execute on function public.create_convoy(uuid, text, double precision, double precision, text),
  public.join_convoy(uuid), public.leave_convoy(uuid), public.end_convoy(uuid), public.my_convoys(),
  public.convoy_state(uuid), public.mark_seen(), public.master_stats(),
  public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text),
  public.take_push_batch(integer), public.push_result(uuid, boolean, boolean), public.invite_preview(text)
  from public, anonymous;
grant execute on function public.create_convoy(uuid, text, double precision, double precision, text),
  public.join_convoy(uuid), public.leave_convoy(uuid), public.end_convoy(uuid), public.my_convoys(),
  public.convoy_state(uuid), public.mark_seen(), public.master_stats(),
  public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text)
  to authenticated;
revoke execute on function public.take_push_batch(integer), public.push_result(uuid, boolean, boolean),
  public.invite_preview(text) from authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'importador') then
    grant execute on function public.take_push_batch(integer), public.push_result(uuid, boolean, boolean),
      public.invite_preview(text) to importador;
  end if;
end $$;

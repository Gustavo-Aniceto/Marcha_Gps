-- Marcha GPS — denunciar e bloquear; erros do app e saúde dos serviços
--
-- 1) Bloquear: quem bloqueia some pra quem foi bloqueado e vice-versa (posts, comentários e o carro no mapa).
--    Avisos do Radar continuam aparecendo: são segurança de todo mundo.
-- 2) Denunciar post, comentário, perfil ou aviso. Com 3 denúncias de pessoas diferentes o post/comentário
--    fica escondido até o Adm Master decidir (manter ou remover). O master é avisado na primeira denúncia.
-- 3) Erros do app chegam pelo marcha-gps-api (usuário "importador") e ficam 30 dias. A checagem de hora em
--    hora do Worker grava se cada serviço respondeu; quando um cai (ou volta) o Adm Master é avisado.

-- ---------------------------------------------------------------------------
-- 1) Bloqueio
-- ---------------------------------------------------------------------------
create table public.user_blocks (
  blocker_id  text not null references public.profiles (id) on delete cascade,
  blocked_id  text not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index on public.user_blocks (blocked_id);
alter table public.user_blocks enable row level security;
grant select on public.user_blocks to authenticated;
create policy blocks_own on public.user_blocks for select to authenticated using (blocker_id = auth.user_id());
-- escrita só pelas funções abaixo

-- algum dos dois bloqueou o outro?
create or replace function public.blocked_with(p_other text, p_uid text default public.current_uid())
returns boolean language sql stable security definer set search_path = public as $$
  select p_other is not null and p_uid is not null and p_other <> p_uid
     and exists (select 1 from public.user_blocks b
                  where (b.blocker_id = p_uid and b.blocked_id = p_other)
                     or (b.blocker_id = p_other and b.blocked_id = p_uid));
$$;

create or replace function public.block_user(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile(); v_other text;
begin
  select id into v_other from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if v_other is null then raise exception 'user_not_found'; end if;
  if v_other = v_uid then raise exception 'cannot_block_self'; end if;
  if (select count(*) from public.user_blocks where blocker_id = v_uid) >= 500 then raise exception 'rate_limited'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_uid, v_other) on conflict do nothing;
end $$;

create or replace function public.unblock_user(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  delete from public.user_blocks b using public.profiles p
   where b.blocker_id = v_uid and b.blocked_id = p.id and p.username = lower(btrim(coalesce(p_username, '')));
end $$;

create or replace function public.my_blocks()
returns table (username text, avatar_key text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.username, p.avatar_key, b.created_at
    from public.user_blocks b join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = public.require_profile()
   order by b.created_at desc;
$$;

-- pro perfil: eu bloqueei essa pessoa? ela me bloqueou?
create or replace function public.block_status(p_username text)
returns table (blocked_by_me boolean, blocked_me boolean)
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks b where b.blocker_id = public.require_profile() and b.blocked_id = p.id),
         exists (select 1 from public.user_blocks b where b.blocker_id = p.id and b.blocked_id = public.current_uid())
    from public.profiles p where p.username = lower(btrim(coalesce(p_username, '')));
$$;

-- ---------------------------------------------------------------------------
-- 2) Denúncias
-- ---------------------------------------------------------------------------
alter table public.posts add column hidden_at timestamptz;
alter table public.post_comments add column hidden_at timestamptz;

-- Some do que a pessoa vê: posts/comentários de quem tem bloqueio com ela e os escondidos por denúncia.
-- (o autor continua vendo o que é dele; o Adm Master vê tudo pra poder decidir)
create policy posts_not_blocked on public.posts as restrictive for select to authenticated
  using (author_id = auth.user_id() or public.is_master()
         or (hidden_at is null and not public.blocked_with(author_id)));
create policy comments_not_blocked on public.post_comments as restrictive for select to authenticated
  using (author_id = auth.user_id() or public.is_master()
         or (hidden_at is null and not public.blocked_with(author_id)));

create table public.content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  text not null references public.profiles (id) on delete cascade,
  target_type  text not null check (target_type in ('post', 'comment', 'profile', 'aviso')),
  target_id    text not null check (length(target_id) <= 64),
  target_owner text references public.profiles (id) on delete set null,
  reason       text not null check (reason in ('ofensivo', 'spam', 'golpe', 'perigoso', 'falso', 'privacidade', 'outro')),
  note         text check (note is null or length(note) <= 500),
  status       text not null default 'open' check (status in ('open', 'kept', 'removed')),
  created_at   timestamptz not null default now(),
  resolved_by  text references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  unique (reporter_id, target_type, target_id)
);
create index on public.content_reports (status, target_type, target_id);
alter table public.content_reports enable row level security;
grant select on public.content_reports to authenticated;
create policy content_reports_own on public.content_reports for select to authenticated
  using (reporter_id = auth.user_id());

-- avisa todo Adm Master (sem olhar preferência: moderação tem que chegar)
create or replace function public.notify_masters(p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, topic, title, body, link)
  select id, p_kind, 'equipes', left(p_title, 120), left(p_body, 300), p_link from public.profiles where is_master;
$$;
revoke execute on function public.notify_masters(text, text, text, text) from public, anonymous, authenticated;

create or replace function public.report_content(p_type text, p_id text, p_reason text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid    text := public.require_profile();
  v_owner  text;
  v_id     text := btrim(coalesce(p_id, ''));
  v_count  int;
  v_hidden boolean := false;
  v_is_uuid boolean := v_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_new    boolean;
begin
  if p_reason is null or p_reason not in ('ofensivo', 'spam', 'golpe', 'perigoso', 'falso', 'privacidade', 'outro') then
    raise exception 'invalid_reason';
  end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'message_too_long'; end if;
  if (select count(*) from public.content_reports where reporter_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;

  -- só denuncia o que consegue ver
  if p_type = 'post' and v_is_uuid then
    select p.author_id into v_owner from public.posts p
     where p.id = v_id::uuid and public.can_see_post(p.id, v_uid);
    if not found then raise exception 'not_found'; end if;
  elsif p_type = 'comment' and v_is_uuid then
    select c.author_id into v_owner from public.post_comments c
     where c.id = v_id::uuid and public.can_see_post(c.post_id, v_uid);
    if not found then raise exception 'not_found'; end if;
  elsif p_type = 'profile' then
    v_id := lower(v_id);
    select p.id into v_owner from public.profiles p where p.username = v_id;
    if not found then raise exception 'not_found'; end if;
  elsif p_type = 'aviso' and v_is_uuid then
    select r.author_id into v_owner from public.reports r where r.id = v_id::uuid;
    if not found then raise exception 'not_found'; end if;
  else
    raise exception 'not_found';
  end if;
  if v_owner = v_uid then raise exception 'own_content'; end if;

  v_new := not exists (select 1 from public.content_reports
                        where target_type = p_type and target_id = v_id and status = 'open');
  insert into public.content_reports (reporter_id, target_type, target_id, target_owner, reason, note)
  values (v_uid, p_type, v_id, v_owner, p_reason, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (reporter_id, target_type, target_id) do nothing;

  select count(distinct reporter_id) into v_count from public.content_reports
   where target_type = p_type and target_id = v_id and status = 'open';

  -- 3 pessoas diferentes: esconde até o master decidir
  if v_count >= 3 then
    if p_type = 'post' then
      update public.posts set hidden_at = coalesce(hidden_at, now()) where id = v_id::uuid;
      v_hidden := true;
    elsif p_type = 'comment' then
      update public.post_comments set hidden_at = coalesce(hidden_at, now()) where id = v_id::uuid;
      v_hidden := true;
    end if;
  end if;

  if v_new then
    perform public.notify_masters('denuncia', 'Nova denúncia: ' ||
      case p_type when 'post' then 'post' when 'comment' then 'comentário' when 'profile' then 'perfil @' || v_id else 'aviso do Radar' end,
      'Motivo: ' || p_reason || '. Confira em Conta > Moderação.', '/moderacao');
  end if;
  return jsonb_build_object('ok', true, 'hidden', v_hidden);
end $$;

-- Fila do Adm Master: uma linha por coisa denunciada, com uma prévia
create or replace function public.master_reports(p_status text default 'open')
returns table (target_type text, target_id text, owner_username text, reports bigint, reasons text[], notes text[],
               first_at timestamptz, last_at timestamptz, hidden boolean, preview text, photo_key text, link text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_master(public.require_profile()) then raise exception 'forbidden'; end if;
  return query
  select r.target_type, r.target_id, max(o.username),
         count(*), array_agg(distinct r.reason), array_remove(array_agg(r.note order by r.created_at), null),
         min(r.created_at), max(r.created_at),
         case r.target_type
           when 'post' then (select p.hidden_at is not null from public.posts p where p.id::text = r.target_id)
           when 'comment' then (select c.hidden_at is not null from public.post_comments c where c.id::text = r.target_id)
           else false end,
         case r.target_type
           when 'post' then (select left(coalesce(p.body, ''), 280) from public.posts p where p.id::text = r.target_id)
           when 'comment' then (select left(c.body, 280) from public.post_comments c where c.id::text = r.target_id)
           when 'profile' then (select left(coalesce(pr.display_name || ' — ', '') || coalesce(pr.bio, ''), 280)
                                  from public.profiles pr where pr.username = r.target_id)
           else (select a.kind || coalesce(' (' || a.speed_limit || ' km/h)', '') || ' · ' || a.status
                   from public.reports a where a.id::text = r.target_id) end,
         case r.target_type
           when 'post' then (select p.photo_key from public.posts p where p.id::text = r.target_id)
           when 'profile' then (select pr.avatar_key from public.profiles pr where pr.username = r.target_id)
           else null end,
         case r.target_type
           when 'post' then '/post/' || r.target_id
           when 'comment' then (select '/post/' || c.post_id from public.post_comments c where c.id::text = r.target_id)
           when 'profile' then '/perfil/' || r.target_id
           else null end
    from public.content_reports r
    left join public.profiles o on o.id = r.target_owner
   where r.status = coalesce(p_status, 'open')
   group by r.target_type, r.target_id
   order by count(*) desc, max(r.created_at) desc
   limit 200;
end $$;

-- Decisão do master: manter (volta a aparecer) ou remover
create or replace function public.resolve_report(p_type text, p_id text, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile(); v_owner text;
begin
  if not public.is_master(v_uid) then raise exception 'forbidden'; end if;
  if p_action not in ('manter', 'remover') then raise exception 'invalid_action'; end if;
  select target_owner into v_owner from public.content_reports
   where target_type = p_type and target_id = p_id and status = 'open' limit 1;
  if not found then raise exception 'request_not_found'; end if;

  if p_action = 'manter' then
    if p_type = 'post' then update public.posts set hidden_at = null where id::text = p_id;
    elsif p_type = 'comment' then update public.post_comments set hidden_at = null where id::text = p_id;
    end if;
  else
    if p_type = 'post' then delete from public.posts where id::text = p_id;
    elsif p_type = 'comment' then delete from public.post_comments where id::text = p_id;
    elsif p_type = 'aviso' then update public.reports set status = 'rejected' where id::text = p_id;
    elsif p_type = 'profile' then
      update public.profiles set avatar_key = null, display_name = null, bio = null where username = p_id;
    end if;
    perform public.notify(v_owner, 'moderacao', 'social',
      case p_type when 'profile' then 'Sua foto e bio foram tiradas do perfil'
                  when 'aviso' then 'Um aviso seu foi retirado do Radar'
                  else 'Uma postagem sua foi removida' end,
      'Foi denunciada e não segue as regras da comunidade. Veja os Termos de uso no app.', '/termos');
  end if;

  update public.content_reports set status = case p_action when 'manter' then 'kept' else 'removed' end,
         resolved_by = v_uid, resolved_at = now()
   where target_type = p_type and target_id = p_id and status = 'open';
end $$;

-- ---------------------------------------------------------------------------
-- O carro de quem tem bloqueio com você não aparece no mapa (igual à 19, só com o filtro novo)
-- ---------------------------------------------------------------------------
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
                    and (p.visibility <> 'crew' or p.visibility_crew is null or a.crew_id = p.visibility_crew)
                  order by a.crew_id) as shared
      from public.profiles p
      join public.live_locations l on l.user_id = p.id
     where p.id <> v_uid
       and p.visibility <> 'ghost'
       and l.updated_at > now() - interval '10 minutes'
       and not public.blocked_with(p.id, v_uid)
  loop
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

-- ---------------------------------------------------------------------------
-- 3) Erros do app e saúde dos serviços
-- ---------------------------------------------------------------------------
create table public.app_errors (
  id          bigint generated always as identity primary key,
  fingerprint text not null,                     -- mensagem + tela, pra juntar repetidos
  message     text not null check (length(message) <= 500),
  stack       text check (stack is null or length(stack) <= 4000),
  screen      text check (screen is null or length(screen) <= 200),
  user_agent  text check (user_agent is null or length(user_agent) <= 300),
  version     text check (version is null or length(version) <= 40),
  user_id     text references public.profiles (id) on delete set null,
  hits        integer not null default 1,
  users       text[] not null default '{}',      -- quem viu (até 50), pra contar pessoas afetadas
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now()
);
create unique index app_errors_fp on public.app_errors (fingerprint, version);
alter table public.app_errors enable row level security;   -- ninguém lê direto; só master_health()

create table public.service_health (
  service     text primary key,
  ok          boolean not null,
  detail      text check (detail is null or length(detail) <= 300),
  ms          integer,
  checked_at  timestamptz not null default now(),
  changed_at  timestamptz not null default now()
);
alter table public.service_health enable row level security;

-- chamado pelo marcha-gps-api (usuário importador). Junta repetidos e tem teto pra não encher o banco.
create or replace function public.log_app_error(p_message text, p_stack text, p_screen text, p_user_agent text,
                                                p_version text, p_user text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_msg  text := left(btrim(coalesce(p_message, '')), 500);
  v_scr  text := left(nullif(btrim(coalesce(p_screen, '')), ''), 200);
  v_ver  text := left(coalesce(nullif(btrim(coalesce(p_version, '')), ''), '?'), 40);
  v_user text := case when p_user is not null and exists (select 1 from public.profiles where id = p_user) then p_user end;
  v_fp   text;
begin
  if v_msg = '' then return; end if;
  -- números (ids, posições) viram # pra juntar o mesmo erro
  v_fp := md5(regexp_replace(v_msg, '[0-9]+', '#', 'g') || '|' || coalesce(regexp_replace(v_scr, '[0-9a-f-]{8,}', '#', 'g'), ''));
  if (select count(*) from public.app_errors where last_at > now() - interval '1 hour') >= 300 then return; end if;
  insert into public.app_errors as e (fingerprint, message, stack, screen, user_agent, version, user_id, users)
  values (v_fp, v_msg, left(p_stack, 4000), v_scr, left(p_user_agent, 300), v_ver, v_user,
          case when v_user is null then '{}' else array[v_user] end)
  on conflict (fingerprint, version) do update
     set hits = e.hits + 1, last_at = now(),
         stack = coalesce(excluded.stack, e.stack), screen = coalesce(excluded.screen, e.screen),
         user_agent = excluded.user_agent,
         users = case when v_user is null or v_user = any (e.users) or cardinality(e.users) >= 50 then e.users
                      else e.users || v_user end;
  -- de vez em quando, limpa o que tem mais de 30 dias
  if random() < 0.02 then delete from public.app_errors where last_at < now() - interval '30 days'; end if;
end $$;

-- resultado da checagem de hora em hora; avisa o master quando muda (caiu / voltou)
create or replace function public.record_health(p_service text, p_ok boolean, p_detail text default null, p_ms integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_old boolean;
begin
  if p_service !~ '^[a-z0-9_]{2,40}$' then raise exception 'invalid_service'; end if;
  select ok into v_old from public.service_health where service = p_service;
  insert into public.service_health (service, ok, detail, ms)
  values (p_service, p_ok, left(p_detail, 300), p_ms)
  on conflict (service) do update
     set ok = excluded.ok, detail = excluded.detail, ms = excluded.ms, checked_at = now(),
         changed_at = case when service_health.ok is distinct from excluded.ok then now() else service_health.changed_at end;
  -- a primeira checagem só registra (assim o login de produção avisa "voltou" quando o domínio entra no ar)
  if v_old is not null and v_old is distinct from p_ok then
    perform public.notify_masters('saude',
      case when p_ok then 'Voltou: ' || p_service else 'Fora do ar: ' || p_service end,
      coalesce(left(p_detail, 200), '') || ' Veja em Conta > Moderação > Saúde do app.', '/moderacao');
  end if;
end $$;

create or replace function public.master_health()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_master(public.require_profile()) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'services', coalesce((select jsonb_agg(jsonb_build_object('service', service, 'ok', ok, 'detail', detail, 'ms', ms,
                                                               'checked_at', checked_at, 'changed_at', changed_at)
                                           order by ok, service) from public.service_health), '[]'),
    'errors', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('message', message, 'screen', screen, 'version', version, 'hits', hits,
                                  'people', cardinality(users), 'first_at', first_at, 'last_at', last_at,
                                  'stack', left(stack, 1200), 'user_agent', user_agent) as x
          from public.app_errors where last_at > now() - interval '7 days'
         order by last_at desc limit 60) s), '[]'),
    'errors_24h', (select coalesce(sum(hits), 0) from public.app_errors where last_at > now() - interval '24 hours'));
end $$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
revoke execute on function public.blocked_with(text, text), public.block_user(text), public.unblock_user(text),
  public.my_blocks(), public.block_status(text), public.report_content(text, text, text, text),
  public.master_reports(text), public.resolve_report(text, text, text), public.master_health(),
  public.log_app_error(text, text, text, text, text, text), public.record_health(text, boolean, text, integer)
  from public, anonymous;
grant execute on function public.blocked_with(text, text), public.block_user(text), public.unblock_user(text),
  public.my_blocks(), public.block_status(text), public.report_content(text, text, text, text),
  public.master_reports(text), public.resolve_report(text, text, text), public.master_health()
  to authenticated;
revoke execute on function public.log_app_error(text, text, text, text, text, text),
  public.record_health(text, boolean, text, integer) from authenticated;
revoke execute on function public.visible_cars(text) from public, anonymous;
grant execute on function public.visible_cars(text) to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'importador') then
    grant execute on function public.log_app_error(text, text, text, text, text, text),
      public.record_health(text, boolean, text, integer) to importador;
  end if;
end $$;

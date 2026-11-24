-- Marcha GPS — funções
-- Toda escrita sensível passa por aqui (security definer), nunca direto na tabela.
-- Erros sobem como exceção com um código curto em inglês (o app traduz).

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public.haversine_m(lat1 double precision, lon1 double precision,
                                              lat2 double precision, lon2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)));
$$;

-- TODO: trocar as caixas por polígonos dos municípios (IBGE) quando tiver PostGIS
create or replace function public.city_for(p_lat double precision, p_lon double precision)
returns text language sql stable set search_path = public as $$
  select id from public.cities
  where p_lat between lat_min and lat_max and p_lon between lon_min and lon_max
  order by priority limit 1;
$$;

create or replace function public.has_profile(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_uid);
$$;

create or replace function public.is_master(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_master from public.profiles where id = p_uid), false);
$$;

create or replace function public.is_crew_member(p_crew uuid, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew_members where crew_id = p_crew and user_id = p_uid);
$$;

create or replace function public.is_verified_in(p_crew uuid, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew_members
                 where crew_id = p_crew and user_id = p_uid and status = 'verified');
$$;

create or replace function public.is_verified_anywhere(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew_members cm join public.crews c on c.id = cm.crew_id
                 where cm.user_id = p_uid and cm.status = 'verified' and c.status = 'active');
$$;

create or replace function public.is_crew_admin(p_crew uuid, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew_members
                 where crew_id = p_crew and user_id = p_uid
                   and status = 'verified' and role in ('founder', 'admin'));
$$;

-- equipe dona do evento (usado nas policies sem cair em recursão)
create or replace function public.event_crew_id(p_event uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select crew_id from public.events where id = p_event;
$$;

create or replace function public.require_profile()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_profile(v_uid) then raise exception 'no_profile'; end if;
  return v_uid;
end $$;

-- ---------------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------------
create or replace function public.create_invite(p_crew uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := public.require_profile();
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
      insert into public.invites (code, crew_id, created_by) values (v_code, p_crew, v_uid);
      exit;
    exception when unique_violation then
      -- tenta outro código
    end;
  end loop;
  return v_code;
end $$;

-- Novo usuário: cria o perfil. Usuário que já existe: entra em mais uma equipe.
create or replace function public.redeem_invite(p_code text, p_username text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invites;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_inv from public.invites where code = upper(trim(p_code)) for update;
  if not found then raise exception 'invite_not_found'; end if;
  if v_inv.used_by is not null then raise exception 'invite_used'; end if;
  if v_inv.expires_at < now() then raise exception 'invite_expired'; end if;
  if v_inv.created_by = v_uid then raise exception 'own_invite'; end if;

  if public.has_profile(v_uid) then
    if v_inv.crew_id is null then raise exception 'already_registered'; end if;
    if public.is_crew_member(v_inv.crew_id, v_uid) then raise exception 'already_member'; end if;
  else
    if p_username is null then raise exception 'username_required'; end if;
    insert into public.profiles (id, username, invited_by)
    values (v_uid, lower(trim(p_username)), v_inv.created_by);
  end if;

  if v_inv.crew_id is not null then
    insert into public.crew_members (crew_id, user_id, role, status, sponsor_id)
    values (v_inv.crew_id, v_uid, 'member', 'pending', v_inv.created_by);
  end if;

  update public.invites set used_by = v_uid, used_at = now() where code = v_inv.code;
  return v_inv.crew_id;
end $$;

-- ---------------------------------------------------------------------------
-- Verificação dos membros
-- ---------------------------------------------------------------------------
create or replace function public.try_verify(p_crew uuid, p_member uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_m      public.crew_members;
  v_needed integer;
begin
  select * into v_m from public.crew_members where crew_id = p_crew and user_id = p_member for update;
  if not found then raise exception 'member_not_found'; end if;
  if v_m.status = 'verified' then return 'verified'; end if;

  -- precisa de 2 confirmações; numa equipe recém-criada (só o fundador verificado) basta 1
  v_needed := least(2, (select count(*) from public.crew_members
                         where crew_id = p_crew and status = 'verified' and user_id <> p_member));
  if (select count(*) from public.member_vouches mv
        join public.crew_members cm on cm.crew_id = mv.crew_id and cm.user_id = mv.voucher_id
       where mv.crew_id = p_crew and mv.member_id = p_member and cm.status = 'verified') >= greatest(v_needed, 1)
     and exists (select 1 from public.member_checkins where crew_id = p_crew and member_id = p_member) then
    update public.crew_members set status = 'verified', verified_at = now()
     where crew_id = p_crew and user_id = p_member;
    -- padrinho ganha XP por convidado verificado
    update public.crew_members set xp = xp + 40
     where crew_id = p_crew and user_id = v_m.sponsor_id;
    return 'verified';
  end if;
  return 'pending';
end $$;

create or replace function public.vouch_member(p_crew uuid, p_member uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_profile();
begin
  if v_uid = p_member then raise exception 'cannot_vouch_self'; end if;
  if not public.is_verified_in(p_crew, v_uid) then raise exception 'forbidden'; end if;
  if not public.is_crew_member(p_crew, p_member) then raise exception 'member_not_found'; end if;
  insert into public.member_vouches (crew_id, member_id, voucher_id)
  values (p_crew, p_member, v_uid) on conflict do nothing;
  return public.try_verify(p_crew, p_member);
end $$;

create or replace function public.admin_checkin(p_crew uuid, p_member uuid, p_event uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_profile();
begin
  if not public.is_crew_admin(p_crew, v_uid) then raise exception 'forbidden'; end if;
  if not public.is_crew_member(p_crew, p_member) then raise exception 'member_not_found'; end if;
  if p_event is not null and not exists (select 1 from public.events where id = p_event and crew_id = p_crew) then
    raise exception 'event_not_found';
  end if;
  insert into public.member_checkins (crew_id, member_id, admin_id, event_id)
  values (p_crew, p_member, v_uid, p_event);
  return public.try_verify(p_crew, p_member);
end $$;

-- ---------------------------------------------------------------------------
-- Equipes: pedido, aprovação pelo Adm Master, tema
-- ---------------------------------------------------------------------------
create or replace function public.review_crew_request(p_request uuid, p_decision text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := public.require_profile();
  v_req  public.crew_requests;
  v_crew uuid;
begin
  if not public.is_master(v_uid) then raise exception 'forbidden'; end if;
  if p_decision not in ('approved', 'rejected', 'more_info') then raise exception 'invalid_decision'; end if;

  select * into v_req from public.crew_requests where id = p_request for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.status in ('approved', 'rejected') then raise exception 'already_reviewed'; end if;

  if p_decision = 'approved' then
    insert into public.crews (name, city_id, instagram)
    values (v_req.name, v_req.city_id, v_req.instagram) returning id into v_crew;
    insert into public.crew_members (crew_id, user_id, role, status, verified_at)
    values (v_crew, v_req.requester_id, 'founder', 'verified', now());
    update public.profiles set invites_left = invites_left + 5 where id = v_req.requester_id;
  end if;

  update public.crew_requests
     set status = p_decision, master_note = p_note, reviewed_by = v_uid, reviewed_at = now(), crew_id = v_crew
   where id = p_request;
  return v_crew;
end $$;

create or replace function public.set_crew_theme(p_crew uuid, p_color text, p_shape text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_profile();
  if not public.is_crew_admin(p_crew) then raise exception 'forbidden'; end if;
  update public.crews set color = upper(p_color), button_shape = p_shape where id = p_crew;
end $$;

create or replace function public.set_member_role(p_crew uuid, p_member uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_profile();
begin
  if not exists (select 1 from public.crew_members where crew_id = p_crew and user_id = v_uid
                   and role = 'founder' and status = 'verified')
     and not public.is_master(v_uid) then
    raise exception 'forbidden';
  end if;
  if p_role not in ('admin', 'member') then raise exception 'invalid_role'; end if;
  update public.crew_members set role = p_role
   where crew_id = p_crew and user_id = p_member and role <> 'founder';
  if not found then raise exception 'member_not_found'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Eventos: "fazer a mídia"
-- A foto é tirada pela câmera do app; o servidor confere local e horário.
-- (GPS do celular pode ser falsificado: a checagem do carro na foto e a
--  contestação do admin cobrem isso.)
-- ---------------------------------------------------------------------------
create or replace function public.submit_event_media(p_event uuid, p_photo_path text,
                                                     p_lat double precision, p_lon double precision)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_profile();
  v_ev  public.events;
  v_id  uuid;
begin
  select * into v_ev from public.events where id = p_event;
  if not found then raise exception 'event_not_found'; end if;
  if not public.is_verified_in(v_ev.crew_id, v_uid) then raise exception 'not_crew_member'; end if;
  if now() < v_ev.starts_at - interval '30 minutes' or now() > v_ev.ends_at then
    raise exception 'outside_event_time';
  end if;
  if public.haversine_m(v_ev.lat, v_ev.lon, p_lat, p_lon) > v_ev.radius_m + 100 then
    raise exception 'outside_event_area';
  end if;
  if exists (select 1 from public.event_media where event_id = p_event and user_id = v_uid) then
    raise exception 'already_submitted';
  end if;

  insert into public.event_media (event_id, user_id, photo_path, lat, lon)
  values (p_event, v_uid, p_photo_path, p_lat, p_lon) returning id into v_id;
  update public.crew_members set xp = xp + 50 where crew_id = v_ev.crew_id and user_id = v_uid;
  return v_id;
end $$;

create or replace function public.contest_event_media(p_media uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m  public.event_media;
  v_ev public.events;
begin
  perform public.require_profile();
  select * into v_m from public.event_media where id = p_media for update;
  if not found then raise exception 'media_not_found'; end if;
  select * into v_ev from public.events where id = v_m.event_id;
  if not public.is_crew_admin(v_ev.crew_id) then raise exception 'forbidden'; end if;
  if v_m.status <> 'accepted' then raise exception 'already_contested'; end if;
  if v_m.created_at < now() - interval '24 hours' then raise exception 'contest_window_closed'; end if;

  update public.event_media set status = 'contested' where id = p_media;
  update public.crew_members set xp = greatest(0, xp - 50)
   where crew_id = v_ev.crew_id and user_id = v_m.user_id;
end $$;

-- ---------------------------------------------------------------------------
-- Radar: avisos, votos, pontos
-- ---------------------------------------------------------------------------
create or replace function public.report_points(p_kind text)
returns integer language sql immutable as $$
  select case
    when p_kind in ('buraco', 'lombada', 'valeta') then 15
    when p_kind in ('blitz', 'rua_ruim', 'alagamento', 'rampa') then 10
    else 5
  end;
$$;

create or replace function public.report_ttl(p_kind text)
returns interval language sql immutable as $$
  select case p_kind
    when 'blitz' then interval '1 hour'
    when 'alagamento' then interval '6 hours'
    else interval '7 days'
  end;
$$;

create or replace function public.confirm_report(p_report uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_r public.reports;
begin
  select * into v_r from public.reports where id = p_report for update;
  if v_r.status <> 'unconfirmed' then return; end if;

  update public.reports
     set status = 'confirmed', confirmed_at = now(),
         -- obstáculo fixo não expira depois de confirmado; blitz e alagamento sim
         expires_at = case when kind in ('blitz', 'alagamento') then expires_at else null end
   where id = p_report;

  if v_r.author_id is not null then
    insert into public.points_ledger (user_id, delta, reason, report_id)
    values (v_r.author_id, public.report_points(v_r.kind), 'report_confirmed', p_report)
    on conflict do nothing;
  end if;

  -- quem confirmou (os 3 primeiros "está lá") ganha 3
  insert into public.points_ledger (user_id, delta, reason, report_id)
  select user_id, 3, 'confirmed_other', p_report
    from public.report_votes
   where report_id = p_report and exists_vote
   order by created_at
   limit 3
  on conflict do nothing;
end $$;

create or replace function public.vote_report(p_report uuid, p_exists boolean, p_clearance text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_profile();
  v_r   public.reports;
  v_yes integer;
  v_no  integer;
begin
  select * into v_r from public.reports where id = p_report for update;
  if not found then raise exception 'report_not_found'; end if;
  if v_r.status not in ('unconfirmed', 'confirmed') or (v_r.expires_at is not null and v_r.expires_at < now()) then
    raise exception 'report_not_active';
  end if;
  if v_r.author_id = v_uid then raise exception 'cannot_vote_own_report'; end if;

  insert into public.report_votes (report_id, user_id, exists_vote, clearance)
  values (p_report, v_uid, p_exists, p_clearance)
  on conflict (report_id, user_id) do update
    set exists_vote = excluded.exists_vote, clearance = excluded.clearance, created_at = now();

  if v_r.status = 'unconfirmed' then
    select count(*) filter (where exists_vote), count(*) filter (where not exists_vote)
      into v_yes, v_no from public.report_votes where report_id = p_report;
    if v_yes >= 3 then
      perform public.confirm_report(p_report);
      return 'confirmed';
    elsif v_no >= 3 then
      update public.reports set status = 'rejected' where id = p_report;
      if v_r.author_id is not null then
        insert into public.points_ledger (user_id, delta, reason, report_id)
        values (v_r.author_id, -5, 'false_report', p_report) on conflict do nothing;
      end if;
      return 'rejected';
    end if;
    return 'unconfirmed';
  end if;

  -- já confirmado: 3 "não está mais lá" depois da confirmação tiram do mapa (sem punir ninguém)
  select count(*) into v_no from public.report_votes
   where report_id = p_report and not exists_vote and created_at > v_r.confirmed_at;
  if v_no >= 3 then
    update public.reports set status = 'expired' where id = p_report;
    return 'expired';
  end if;
  return 'confirmed';
end $$;

create or replace function public.create_report(p_kind text, p_lat double precision, p_lon double precision)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := public.require_profile();
  v_city text := public.city_for(p_lat, p_lon);
  v_id   uuid;
begin
  if v_city is null then raise exception 'outside_area'; end if;
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
    if (select author_id from public.reports where id = v_id) is distinct from v_uid then
      perform public.vote_report(v_id, true, null);
    end if;
    return v_id;
  end if;

  insert into public.reports (kind, lat, lon, city_id, source, author_id, base_risk, expires_at)
  values (p_kind, p_lat, p_lon, v_city, 'user', v_uid,
          case when p_kind in ('lombada', 'valeta', 'buraco', 'rampa') then 3
               when p_kind in ('radar', 'blitz') then 0 else 2 end,
          now() + public.report_ttl(p_kind))
  returning id into v_id;
  return v_id;
end $$;

-- rodar de tempos em tempos (pg_cron no Supabase: a cada 5 min)
create or replace function public.expire_reports()
returns integer language sql security definer set search_path = public as $$
  with x as (
    update public.reports set status = 'expired'
     where status in ('unconfirmed', 'confirmed') and expires_at is not null and expires_at < now()
    returning 1)
  select count(*)::integer from x;
$$;

-- Ranking geral do Radar (SP, Guarulhos, Itaquá)
create or replace function public.radar_leaderboard(p_limit integer default 50)
returns table (rank_pos bigint, username text, points bigint, confirmed_reports bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.require_profile();
  return query
    select rank() over (order by sum(l.delta) desc), p.username, sum(l.delta),
           count(*) filter (where l.reason = 'report_confirmed')
      from public.points_ledger l join public.profiles p on p.id = l.user_id
     group by p.id, p.username
     order by 3 desc
     limit least(greatest(p_limit, 1), 200);
end $$;

-- Rank interno: só membro da equipe vê
create or replace function public.crew_leaderboard(p_crew uuid)
returns table (rank_pos bigint, user_id uuid, username text, role text, xp integer)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.require_profile();
  if not public.is_crew_member(p_crew) then raise exception 'forbidden'; end if;
  return query
    select rank() over (order by cm.xp desc), cm.user_id, p.username, cm.role, cm.xp
      from public.crew_members cm join public.profiles p on p.id = cm.user_id
     where cm.crew_id = p_crew and cm.status = 'verified'
     order by cm.xp desc;
end $$;

-- ---------------------------------------------------------------------------
-- Localização
-- ---------------------------------------------------------------------------
create or replace function public.update_my_location(p_lat double precision, p_lon double precision,
                                                     p_heading integer default null, p_active_crew uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_profile();
begin
  if p_active_crew is not null and not public.is_verified_in(p_active_crew, v_uid) then
    p_active_crew := null;
  end if;
  insert into public.live_locations (user_id, lat, lon, heading, active_crew_id, updated_at)
  values (v_uid, p_lat, p_lon, p_heading, p_active_crew, now())
  on conflict (user_id) do update
    set lat = excluded.lat, lon = excluded.lon, heading = excluded.heading,
        active_crew_id = excluded.active_crew_id, updated_at = now();
  insert into public.location_history (user_id, lat, lon) values (v_uid, p_lat, p_lon);
  delete from public.location_history where user_id = v_uid and recorded_at < now() - interval '15 minutes';
end $$;

create or replace function public.stop_sharing_location()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_profile();
begin
  delete from public.live_locations where user_id = v_uid;
  delete from public.location_history where user_id = v_uid;
end $$;

-- Quem o usuário atual pode ver no mapa, e onde.
-- Regras (docs/decisoes.md):
--   * fantasma: ninguém vê
--   * parado há mais de 10 min (sem atualizar): some
--   * dentro de zona privada da pessoa: some pra todo mundo, até pra equipe
--   * mesma equipe (os dois verificados): posição exata e atual
--   * "cena": só quem é verificado em alguma equipe vê; posição com o atraso escolhido
--     e arredondada pra ~500 m, a não ser que a pessoa libere a posição exata
create or replace function public.visible_cars(p_city text default null)
returns table (user_id uuid, username text, lat double precision, lon double precision,
               heading smallint, approximate boolean, same_crew boolean, car jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid       uuid := public.require_profile();
  v_viewer_ok boolean := public.is_verified_anywhere(v_uid);
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
           exists (select 1 from public.crew_members a
                     join public.crew_members b on b.crew_id = a.crew_id
                     join public.crews c on c.id = a.crew_id
                    where a.user_id = p.id and b.user_id = v_uid
                      and a.status = 'verified' and b.status = 'verified' and c.status = 'active') as shared
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

    if r.shared then
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
    approximate := v_approx; same_crew := r.shared;
    updated_at := case when v_approx or (not r.shared and r.delay_minutes > 0)
                       then date_trunc('minute', r.updated_at) else r.updated_at end;
    car := (select jsonb_build_object('make', c.make, 'model', c.model, 'color', c.color,
                                      'ride_height_cm', c.ride_height_cm, 'suspension', c.suspension,
                                      'rim', c.rim, 'wheel_position', c.wheel_position,
                                      'camber_deg', c.camber_deg, 'tint', c.tint,
                                      'spoiler', c.spoiler, 'neon', c.neon)
              from public.cars c where c.owner_id = r.id and c.is_active);
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

-- internas: ninguém chama direto
revoke execute on function public.try_verify(uuid, uuid) from authenticated;
revoke execute on function public.confirm_report(uuid) from authenticated;
revoke execute on function public.expire_reports() from authenticated;
revoke execute on function public.require_profile() from authenticated;

grant execute on function
  public.haversine_m(double precision, double precision, double precision, double precision),
  public.city_for(double precision, double precision),
  public.has_profile(uuid), public.is_master(uuid), public.is_crew_member(uuid, uuid), public.event_crew_id(uuid),
  public.is_verified_in(uuid, uuid), public.is_verified_anywhere(uuid), public.is_crew_admin(uuid, uuid),
  public.create_invite(uuid), public.redeem_invite(text, text),
  public.vouch_member(uuid, uuid), public.admin_checkin(uuid, uuid, uuid),
  public.review_crew_request(uuid, text, text), public.set_crew_theme(uuid, text, text),
  public.set_member_role(uuid, uuid, text),
  public.submit_event_media(uuid, text, double precision, double precision),
  public.contest_event_media(uuid),
  public.report_points(text), public.report_ttl(text),
  public.vote_report(uuid, boolean, text), public.create_report(text, double precision, double precision),
  public.radar_leaderboard(integer), public.crew_leaderboard(uuid),
  public.update_my_location(double precision, double precision, integer, uuid),
  public.stop_sharing_location(), public.visible_cars(text)
to authenticated;

-- Marcha GPS — perfil vira mural: post, foto do carro e enquete. E o Adm Master vê a Cena ao vivo.

-- 1) Tipo do post
alter table public.posts add column kind text not null default 'post'
  check (kind in ('post', 'carro', 'enquete'));
alter table public.posts add constraint posts_carro_tem_foto check (kind <> 'carro' or photo_key is not null);
create index on public.posts (author_id, kind, created_at desc);

-- enquete só nasce pela create_poll (com as opções juntas); post e foto do carro continuam pelo insert
alter policy posts_insert on public.posts with check (
  author_id = auth.user_id() and public.has_profile()
  and kind in ('post', 'carro')
  and (crew_id is null or public.is_crew_member(crew_id))
  and (photo_key is null or split_part(photo_key, '/', 2) = auth.user_id())
  and (event_id is null or exists (select 1 from public.events e where e.id = event_id))
);

-- 2) Enquetes: opções e votos (voto é secreto: só o total aparece)
create table public.poll_options (
  post_id uuid not null references public.posts (id) on delete cascade,
  idx     smallint not null check (idx between 0 and 3),
  label   text not null check (length(btrim(label)) between 1 and 60),
  primary key (post_id, idx)
);
create table public.poll_votes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    text not null references public.profiles (id) on delete cascade,
  idx        smallint not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id),
  foreign key (post_id, idx) references public.poll_options (post_id, idx) on delete cascade
);
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.poll_options, public.poll_votes from anonymous, authenticated;
-- opções: quem vê o post vê as opções (a policy de posts decide)
grant select on public.poll_options to authenticated;
create policy poll_options_read on public.poll_options for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
-- votos: ninguém lê direto; contagem só pela poll_json()
create policy poll_votes_none on public.poll_votes for select to authenticated using (false);

-- a pessoa pode ver este post? (mesma regra da policy posts_read)
create or replace function public.can_see_post(p_post uuid, p_uid text default public.current_uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.posts p
                  where p.id = p_post
                    and ((p.crew_id is null and public.has_profile(p_uid)) or public.is_crew_member(p.crew_id, p_uid)));
$$;

-- resultado da enquete: opções com votos, total e o voto da pessoa (null se não votou)
create or replace function public.poll_json(p_post uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.can_see_post(p_post) then null else (
    select jsonb_build_object(
      'options', coalesce(jsonb_agg(jsonb_build_object('idx', o.idx, 'label', o.label,
                   'votes', (select count(*) from public.poll_votes v where v.post_id = o.post_id and v.idx = o.idx))
                 order by o.idx), '[]'::jsonb),
      'total', (select count(*) from public.poll_votes v where v.post_id = p_post),
      'my_vote', (select v.idx from public.poll_votes v where v.post_id = p_post and v.user_id = public.current_uid()))
      from public.poll_options o where o.post_id = p_post) end;
$$;

create or replace function public.create_poll(p_question text, p_options text[], p_crew uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid  text := public.require_profile();
  v_id   uuid;
  v_opts text[];
  i      int;
begin
  if length(btrim(coalesce(p_question, ''))) not between 1 and 300 then raise exception 'invalid_poll'; end if;
  select array_agg(btrim(o) order by n) into v_opts
    from unnest(p_options) with ordinality as t(o, n) where length(btrim(o)) > 0;
  if coalesce(array_length(v_opts, 1), 0) not between 2 and 4 then raise exception 'invalid_poll'; end if;
  if exists (select 1 from unnest(v_opts) o where length(o) > 60) then raise exception 'invalid_poll'; end if;
  if p_crew is not null and not public.is_crew_member(p_crew, v_uid) then raise exception 'not_member'; end if;
  if (select count(*) from public.posts where author_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;

  insert into public.posts (author_id, crew_id, body, kind) values (v_uid, p_crew, btrim(p_question), 'enquete')
  returning id into v_id;
  for i in 1 .. array_length(v_opts, 1) loop
    insert into public.poll_options (post_id, idx, label) values (v_id, i - 1, v_opts[i]);
  end loop;
  return v_id;
end $$;

-- votar (ou trocar o voto)
create or replace function public.vote_poll(p_post uuid, p_idx integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  if not public.can_see_post(p_post, v_uid) then raise exception 'not_found'; end if;
  if not exists (select 1 from public.poll_options where post_id = p_post and idx = p_idx) then
    raise exception 'invalid_poll';
  end if;
  insert into public.poll_votes (post_id, user_id, idx) values (p_post, v_uid, p_idx)
  on conflict (post_id, user_id) do update set idx = excluded.idx, created_at = now();
  return public.poll_json(p_post);
end $$;

-- 3) Feed com tipo, enquete e filtro por tipo (perfil: "Fotos do carro", "Enquetes")
drop function public.feed(uuid, timestamptz, integer, text);
create function public.feed(p_crew uuid default null, p_before timestamptz default null,
                            p_limit integer default 30, p_author text default null, p_kind text default null)
returns table (id uuid, author_id text, username text, avatar_key text, author_car text,
               crew_id uuid, crew_name text, crew_color text, event_id uuid, body text, photo_key text,
               created_at timestamptz, likes bigint, liked_by_me boolean, comments bigint, mine boolean,
               kind text, poll jsonb)
language sql stable security invoker set search_path = public as $$
  select p.id, p.author_id, pr.username, pr.avatar_key,
         (select trim(c.make || ' ' || c.model) from public.cars c where c.owner_id = p.author_id and c.is_active),
         p.crew_id, c.name, c.color, p.event_id, p.body, p.photo_key, p.created_at,
         (select count(*) from public.post_likes l where l.post_id = p.id),
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = public.current_uid()),
         (select count(*) from public.post_comments m where m.post_id = p.id),
         p.author_id = public.current_uid(),
         p.kind,
         case when p.kind = 'enquete' then public.poll_json(p.id) end
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    left join public.crews c on c.id = p.crew_id
   where (case when p_author is not null then p.author_id = p_author
               when p_crew is null then p.crew_id is null
               else p.crew_id = p_crew end)
     and (p_kind is null or p.kind = p_kind)
     and (p_before is null or p.created_at < p_before)
   order by p.created_at desc
   limit least(greatest(p_limit, 1), 100);
$$;

-- 4) Cena ao vivo: o Adm Master também vê (antes só membro verificado de alguma equipe)
create or replace function public.can_view_scene(p_uid text default public.current_uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_verified_anywhere(p_uid) or public.is_master(p_uid);
$$;

-- visible_cars igual à anterior, só trocando quem pode ver
create or replace function public.visible_cars(p_city text default null)
returns table (user_id text, username text, lat double precision, lon double precision,
               heading smallint, approximate boolean, same_crew boolean, car jsonb, updated_at timestamptz)
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

revoke execute on function public.can_see_post(uuid, text), public.poll_json(uuid),
  public.create_poll(text, text[], uuid), public.vote_poll(uuid, integer),
  public.feed(uuid, timestamptz, integer, text, text), public.can_view_scene(text) from public, anonymous;
grant execute on function public.poll_json(uuid), public.create_poll(text, text[], uuid),
  public.vote_poll(uuid, integer), public.feed(uuid, timestamptz, integer, text, text) to authenticated;

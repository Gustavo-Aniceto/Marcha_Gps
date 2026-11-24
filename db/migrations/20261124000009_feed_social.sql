-- Marcha GPS — conserta o feed e deixa ele com cara de rede social.
--
-- Bug: no Neon, os papéis authenticated/anonymous não têm USAGE no schema auth. As policies funcionam
-- (já ficam compiladas), mas função SECURITY INVOKER que chama auth.user_id() no corpo dá
-- "permission denied for schema auth" — por isso feed() e upcoming_events() voltavam vazios.
-- Regra daqui pra frente: em função INVOKER use public.current_uid().

create or replace function public.current_uid()
returns text language sql stable security definer set search_path = public as $$
  select auth.user_id();
$$;
revoke execute on function public.current_uid() from public, anonymous;
grant execute on function public.current_uid() to authenticated;

-- Foto de perfil
alter table public.profiles add column avatar_key text
  check (avatar_key is null or avatar_key ~ '^[a-z]+/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.(jpg|png|webp)$');
grant select (avatar_key) on public.profiles to authenticated;

create or replace function public.set_my_avatar(p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  if p_key is not null and not public.check_own_photo_key(p_key, v_uid) then raise exception 'invalid_photo'; end if;
  update public.profiles set avatar_key = p_key where id = v_uid;
end $$;

-- my_profile agora traz a foto também
drop function public.my_profile();
create function public.my_profile()
returns table (id text, username text, is_master boolean, invites_left integer,
               visibility text, precise_for_scene boolean, delay_minutes integer, avatar_key text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.is_master, p.invites_left, p.visibility, p.precise_for_scene, p.delay_minutes, p.avatar_key
    from public.profiles p
   where p.id = auth.user_id();
$$;

-- Comentários
create table public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  author_id   text not null references public.profiles (id) on delete cascade,
  body        text not null check (length(btrim(body)) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
grant select, insert, delete on public.post_comments to authenticated;
revoke all on public.post_comments from anonymous;

-- vê/comenta quem vê o post (a policy de posts vale dentro do exists)
create policy comments_read on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy comments_insert on public.post_comments for insert to authenticated
  with check (author_id = auth.user_id() and public.has_profile()
              and exists (select 1 from public.posts p where p.id = post_id));
create policy comments_delete on public.post_comments for delete to authenticated
  using (author_id = auth.user_id()
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.user_id())
         or public.is_master());

create or replace function public.post_comments_of(p_post uuid)
returns table (id uuid, author_id text, username text, avatar_key text, body text, created_at timestamptz, mine boolean)
language sql stable security invoker set search_path = public as $$
  select c.id, c.author_id, pr.username, pr.avatar_key, c.body, c.created_at, c.author_id = public.current_uid()
    from public.post_comments c join public.profiles pr on pr.id = c.author_id
   where c.post_id = p_post
   order by c.created_at
   limit 200;
$$;

-- Feed: mais campos (foto do autor, carro dele, comentários, se é meu) e filtro por autor (perfil)
drop function public.feed(uuid, timestamptz, integer);
create function public.feed(p_crew uuid default null, p_before timestamptz default null,
                            p_limit integer default 30, p_author text default null)
returns table (id uuid, author_id text, username text, avatar_key text, author_car text,
               crew_id uuid, crew_name text, crew_color text, event_id uuid, body text, photo_key text,
               created_at timestamptz, likes bigint, liked_by_me boolean, comments bigint, mine boolean)
language sql stable security invoker set search_path = public as $$
  select p.id, p.author_id, pr.username, pr.avatar_key,
         (select trim(c.make || ' ' || c.model) from public.cars c where c.owner_id = p.author_id and c.is_active),
         p.crew_id, c.name, c.color, p.event_id, p.body, p.photo_key, p.created_at,
         (select count(*) from public.post_likes l where l.post_id = p.id),
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = public.current_uid()),
         (select count(*) from public.post_comments m where m.post_id = p.id),
         p.author_id = public.current_uid()
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    left join public.crews c on c.id = p.crew_id
   where (case when p_author is not null then p.author_id = p_author
               when p_crew is null then p.crew_id is null
               else p.crew_id = p_crew end)
     and (p_before is null or p.created_at < p_before)
   order by p.created_at desc
   limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.upcoming_events(p_limit integer default 30)
returns table (id uuid, crew_id uuid, crew_name text, crew_color text, kind text, title text,
               starts_at timestamptz, ends_at timestamptz, lat double precision, lon double precision,
               radius_m integer, visibility text, going bigint, i_am_going boolean, my_media boolean)
language sql stable security invoker set search_path = public as $$
  select e.id, e.crew_id, c.name, c.color, e.kind, e.title, e.starts_at, e.ends_at, e.lat, e.lon, e.radius_m, e.visibility,
         (select count(*) from public.event_rsvps r where r.event_id = e.id),
         exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = public.current_uid()),
         exists (select 1 from public.event_media m where m.event_id = e.id and m.user_id = public.current_uid())
    from public.events e
    join public.crews c on c.id = e.crew_id
   where e.ends_at > now()
   order by e.starts_at
   limit least(greatest(p_limit, 1), 100);
$$;

-- Perfil público (o que qualquer membro pode ver de outro)
create or replace function public.public_profile(p_username text)
returns table (id text, username text, avatar_key text, joined_at timestamptz, car jsonb, posts bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.avatar_key, p.created_at,
         (select jsonb_build_object('make', c.make, 'model', c.model, 'year', c.year, 'color', c.color,
                                    'ride_height_cm', c.ride_height_cm, 'suspension', c.suspension, 'rim', c.rim,
                                    'neon', c.neon, 'spoiler', c.spoiler)
            from public.cars c where c.owner_id = p.id and c.is_active),
         (select count(*) from public.posts x where x.author_id = p.id and x.crew_id is null),
         p.id = auth.user_id()
    from public.profiles p
   where public.has_profile() and p.username = lower(trim(p_username));
$$;

revoke execute on function public.set_my_avatar(text), public.my_profile(), public.post_comments_of(uuid),
  public.feed(uuid, timestamptz, integer, text), public.upcoming_events(integer), public.public_profile(text)
  from public, anonymous;
grant execute on function public.set_my_avatar(text), public.my_profile(), public.post_comments_of(uuid),
  public.feed(uuid, timestamptz, integer, text), public.upcoming_events(integer), public.public_profile(text)
  to authenticated;

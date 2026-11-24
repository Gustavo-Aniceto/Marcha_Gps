-- Marcha GPS — feed (equipe e geral), curtidas e presença em eventos

create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   text not null references public.profiles (id) on delete cascade,
  crew_id     uuid references public.crews (id) on delete cascade,   -- nulo = feed geral
  event_id    uuid references public.events (id) on delete set null, -- post ligado a um evento (convite, mídia)
  body        text not null check (length(btrim(body)) between 1 and 1000),
  photo_key   text check (photo_key ~ '^[a-z]+/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.(jpg|png|webp)$'), -- chave no R2
  created_at  timestamptz not null default now()
);
create index on public.posts (crew_id, created_at desc);
create index on public.posts (created_at desc) where crew_id is null;

create table public.post_likes (
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     text not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.event_rsvps (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     text not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.posts       enable row level security;
alter table public.post_likes  enable row level security;
alter table public.event_rsvps enable row level security;

grant select, insert, delete on public.posts, public.post_likes, public.event_rsvps to authenticated;
revoke all on public.posts, public.post_likes, public.event_rsvps from anonymous;

-- posts: geral = quem tem perfil; equipe = membros (pendentes também veem, como combinado)
create policy posts_read on public.posts for select to authenticated
  using ((crew_id is null and public.has_profile()) or public.is_crew_member(crew_id));

create policy posts_insert on public.posts for insert to authenticated
  with check (
    author_id = auth.user_id() and public.has_profile()
    and (crew_id is null or public.is_crew_member(crew_id))
    and (photo_key is null or split_part(photo_key, '/', 2) = auth.user_id())               -- só foto que a própria pessoa subiu
    and (event_id is null or exists (select 1 from public.events e where e.id = event_id))  -- só evento que a pessoa vê
  );

create policy posts_delete on public.posts for delete to authenticated
  using (author_id = auth.user_id()
         or (crew_id is not null and public.is_crew_admin(crew_id))
         or public.is_master());

-- curtidas
create policy likes_read on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy likes_insert on public.post_likes for insert to authenticated
  with check (user_id = auth.user_id() and exists (select 1 from public.posts p where p.id = post_id));
create policy likes_delete on public.post_likes for delete to authenticated
  using (user_id = auth.user_id());

-- presença ("vou")
create policy rsvps_read on public.event_rsvps for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy rsvps_insert on public.event_rsvps for insert to authenticated
  with check (user_id = auth.user_id() and public.has_profile()
              and exists (select 1 from public.events e where e.id = event_id and e.ends_at > now()));
create policy rsvps_delete on public.event_rsvps for delete to authenticated
  using (user_id = auth.user_id());

-- Feed pronto pra tela. Roda com as permissões de quem chama (RLS vale).
create or replace function public.feed(p_crew uuid default null, p_before timestamptz default null,
                                       p_limit integer default 30)
returns table (id uuid, author_id text, username text, crew_id uuid, crew_name text, crew_color text,
               event_id uuid, body text, photo_key text, created_at timestamptz,
               likes bigint, liked_by_me boolean)
language sql stable security invoker set search_path = public as $$
  select p.id, p.author_id, pr.username, p.crew_id, c.name, c.color, p.event_id, p.body, p.photo_key, p.created_at,
         (select count(*) from public.post_likes l where l.post_id = p.id),
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.user_id())
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    left join public.crews c on c.id = p.crew_id
   where (case when p_crew is null then p.crew_id is null else p.crew_id = p_crew end)
     and (p_before is null or p.created_at < p_before)
   order by p.created_at desc
   limit least(greatest(p_limit, 1), 100);
$$;

-- Próximos eventos que a pessoa pode ver, com quantos vão e se ela vai
create or replace function public.upcoming_events(p_limit integer default 30)
returns table (id uuid, crew_id uuid, crew_name text, crew_color text, kind text, title text,
               starts_at timestamptz, ends_at timestamptz, lat double precision, lon double precision,
               radius_m integer, visibility text, going bigint, i_am_going boolean, my_media boolean)
language sql stable security invoker set search_path = public as $$
  select e.id, e.crew_id, c.name, c.color, e.kind, e.title, e.starts_at, e.ends_at, e.lat, e.lon, e.radius_m, e.visibility,
         (select count(*) from public.event_rsvps r where r.event_id = e.id),
         exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = auth.user_id()),
         exists (select 1 from public.event_media m where m.event_id = e.id and m.user_id = auth.user_id())
    from public.events e
    join public.crews c on c.id = e.crew_id
   where e.ends_at > now()
   order by e.starts_at
   limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function public.feed(uuid, timestamptz, integer), public.upcoming_events(integer) from public, anonymous;
grant execute on function public.feed(uuid, timestamptz, integer), public.upcoming_events(integer) to authenticated;

-- A foto da mídia tem que ser da própria pessoa (chave media/<user_id>/<uuid>.jpg gerada pelo serviço de fotos)
create or replace function public.check_own_photo_key(p_key text, p_uid text)
returns boolean language sql immutable as $$
  select p_key ~ '^[a-z]+/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.(jpg|png|webp)$' and split_part(p_key, '/', 2) = p_uid;
$$;

create or replace function public.submit_event_media_checked(p_event uuid, p_photo_key text,
                                                             p_lat double precision, p_lon double precision)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  if not public.check_own_photo_key(p_photo_key, v_uid) then raise exception 'invalid_photo'; end if;
  return public.submit_event_media(p_event, p_photo_key, p_lat, p_lon);
end $$;

-- o app usa a versão que confere a foto; a antiga fica só pra uso interno
revoke execute on function public.submit_event_media(uuid, text, double precision, double precision) from authenticated;
revoke execute on function public.submit_event_media_checked(uuid, text, double precision, double precision), public.check_own_photo_key(text, text) from public, anonymous;
grant execute on function public.submit_event_media_checked(uuid, text, double precision, double precision) to authenticated;

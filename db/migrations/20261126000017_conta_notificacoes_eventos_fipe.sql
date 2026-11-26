-- Marcha GPS — conta (editar perfil, notificações, privacidade/dados), painel de eventos,
-- descobrir equipes e ficha do carro pela tabela FIPE.

-- ---------------------------------------------------------------------------
-- 6) Ficha do carro pela tabela FIPE
-- ---------------------------------------------------------------------------
alter table public.cars
  add column fipe_code text check (fipe_code is null or fipe_code ~ '^[0-9]{6}-[0-9]$'),
  add column fipe_brand text check (fipe_brand is null or length(fipe_brand) <= 60),
  add column fipe_model text check (fipe_model is null or length(fipe_model) <= 120),
  add column fipe_version text check (fipe_version is null or length(fipe_version) <= 120),
  add column fipe_year integer check (fipe_year is null or fipe_year between 1950 and 2100),
  add column fipe_fuel text check (fipe_fuel is null or length(fipe_fuel) <= 30),
  add column fipe_price text check (fipe_price is null or length(fipe_price) <= 30),
  add column fipe_ref text check (fipe_ref is null or length(fipe_ref) <= 40);

-- ---------------------------------------------------------------------------
-- 1) Perfil: nome pra mostrar, bio e o que a pessoa quer ser avisada
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column display_name text check (display_name is null or length(display_name) between 1 and 40),
  add column bio text check (bio is null or length(bio) <= 300),
  add column notify_prefs jsonb not null default '{"equipes": true, "eventos": true, "social": true}';

create or replace function public.set_my_profile(p_display_name text, p_bio text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid text := public.require_profile();
  v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
begin
  if v_name is not null and length(v_name) > 40 then raise exception 'name_too_long'; end if;
  if v_bio is not null and length(v_bio) > 300 then raise exception 'bio_too_long'; end if;
  update public.profiles set display_name = v_name, bio = v_bio where id = v_uid;
end $$;

create or replace function public.set_notify_prefs(p_equipes boolean, p_eventos boolean, p_social boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set notify_prefs = jsonb_build_object('equipes', p_equipes, 'eventos', p_eventos, 'social', p_social)
   where id = public.require_profile();
end $$;

drop function public.my_profile();
create function public.my_profile()
returns table (id text, username text, is_master boolean, invites_left integer,
               visibility text, precise_for_scene boolean, delay_minutes integer, avatar_key text,
               display_name text, bio text, notify_prefs jsonb, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.is_master, p.invites_left, p.visibility, p.precise_for_scene, p.delay_minutes, p.avatar_key,
         p.display_name, p.bio, p.notify_prefs, p.created_at
    from public.profiles p
   where p.id = auth.user_id();
$$;

drop function public.public_profile(text);
create function public.public_profile(p_username text)
returns table (id text, username text, avatar_key text, joined_at timestamptz, car jsonb, posts bigint, mine boolean,
               display_name text, bio text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.avatar_key, p.created_at,
         (select jsonb_build_object('make', c.make, 'model', c.model, 'year', c.year, 'color', c.color,
                                    'ride_height_cm', c.ride_height_cm, 'suspension', c.suspension, 'rim', c.rim,
                                    'neon', c.neon, 'spoiler', c.spoiler,
                                    'body_type', c.body_type, 'tint', c.tint,
                                    'version', c.fipe_version, 'fuel', c.fipe_fuel,
                                    'photos', to_jsonb(c.photo_paths[1:3]))
            from public.cars c where c.owner_id = p.id and c.is_active),
         (select count(*) from public.posts x where x.author_id = p.id and x.crew_id is null),
         p.id = auth.user_id(),
         p.display_name, p.bio
    from public.profiles p
   where public.has_profile() and p.username = lower(trim(p_username));
$$;

-- ---------------------------------------------------------------------------
-- 2) Notificações dentro do app
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references public.profiles (id) on delete cascade,
  kind        text not null,                -- equipe_pedida, equipe_decidida, pedido_entrar, entrada_decidida, verificado, evento, comentario, convite_usado
  topic       text not null check (topic in ('equipes', 'eventos', 'social')),
  title       text not null check (length(title) <= 120),
  body        text check (body is null or length(body) <= 300),
  link        text check (link is null or link ~ '^/[A-Za-z0-9/_\-\[\]\.]*$'),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
create policy notifications_own on public.notifications for select to authenticated
  using (user_id = auth.user_id());
-- escrita só pelas funções e gatilhos abaixo

-- Cria o aviso respeitando o que a pessoa escolheu receber
create or replace function public.notify(p_user text, p_kind text, p_topic text, p_title text,
                                         p_body text default null, p_link text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  if coalesce((select (notify_prefs ->> p_topic)::boolean from public.profiles where id = p_user), false) is false then
    return;
  end if;
  insert into public.notifications (user_id, kind, topic, title, body, link)
  values (p_user, p_kind, p_topic, left(p_title, 120), left(p_body, 300), p_link);
end $$;
revoke execute on function public.notify(text, text, text, text, text, text) from public, anonymous, authenticated;

create or replace function public.my_notifications(p_limit integer default 50)
returns table (id uuid, kind text, title text, body text, link text, created_at timestamptz, read boolean)
language sql stable security definer set search_path = public as $$
  select n.id, n.kind, n.title, n.body, n.link, n.created_at, n.read_at is not null
    from public.notifications n
   where n.user_id = public.require_profile()
   order by n.created_at desc
   limit least(greatest(p_limit, 1), 200);
$$;

create or replace function public.unread_notifications()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications where user_id = auth.user_id() and read_at is null;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.notifications set read_at = now()
   where user_id = public.require_profile() and read_at is null
     and (p_ids is null or id = any (p_ids));
end $$;

-- Equipe nova pedida -> todo Adm Master; resposta do master -> quem pediu
create or replace function public.trg_notify_crew_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if tg_op = 'INSERT' then
    for m in select id from public.profiles where is_master loop
      perform public.notify(m.id, 'equipe_pedida', 'equipes', 'Nova equipe pedida: ' || new.name,
        'De @' || (select username from public.profiles where id = new.requester_id) || '. Confira na aba Equipes.', '/equipes');
    end loop;
  elsif new.status is distinct from old.status then
    if new.status = 'approved' then
      perform public.notify(new.requester_id, 'equipe_decidida', 'equipes', 'Sua equipe foi aprovada! 🎉',
        new.name || ' já está no Marcha GPS. Monte a página e convide a galera.',
        case when new.crew_id is not null then '/equipe/' || new.crew_id else '/equipes' end);
    elsif new.status = 'rejected' then
      perform public.notify(new.requester_id, 'equipe_decidida', 'equipes', 'Pedido da equipe ' || new.name || ' não foi aprovado',
        coalesce(new.master_note, 'Fale com o Adm Master pra saber mais.'), '/equipes');
    elsif new.status = 'more_info' then
      perform public.notify(new.requester_id, 'equipe_decidida', 'equipes', 'O Adm Master pediu mais informações',
        coalesce(new.master_note, 'Abra a aba Equipes pra ver.'), '/equipes');
    end if;
  end if;
  return new;
end $$;
create trigger notify_crew_request after insert or update on public.crew_requests
  for each row execute function public.trg_notify_crew_request();

-- Pedido pra entrar -> fundador/admins; decisão -> quem pediu
create or replace function public.trg_notify_join_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; v_crew text; v_user text;
begin
  select name into v_crew from public.crews where id = new.crew_id;
  select username into v_user from public.profiles where id = new.user_id;
  if tg_op = 'INSERT' then
    for a in select user_id from public.crew_members
              where crew_id = new.crew_id and role in ('founder', 'admin') and status = 'verified' loop
      perform public.notify(a.user_id, 'pedido_entrar', 'equipes', '@' || v_user || ' quer entrar na ' || v_crew,
        coalesce(new.message, 'Toque pra aprovar ou recusar.'), '/equipes');
    end loop;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform public.notify(new.user_id, 'entrada_decidida', 'equipes',
      case when new.status = 'approved' then 'Você entrou na ' || v_crew || '!' else 'Seu pedido pra ' || v_crew || ' foi recusado' end,
      case when new.status = 'approved' then 'Agora a galera confirma que te conhece e um admin faz o check-in num encontro.'
           else 'Dá pra pedir de novo depois de 7 dias.' end,
      '/equipe/' || new.crew_id);
  end if;
  return new;
end $$;
create trigger notify_join_request after insert or update on public.crew_join_requests
  for each row execute function public.trg_notify_join_request();

-- Virou membro verificado
create or replace function public.trg_notify_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' and new.role <> 'founder' then
    perform public.notify(new.user_id, 'verificado', 'equipes',
      'Você é membro verificado da ' || (select name from public.crews where id = new.crew_id) || '!',
      'Agora você vê a equipe no mapa e a Cena ao vivo.', '/equipe/' || new.crew_id);
  end if;
  return new;
end $$;
create trigger notify_verified after update on public.crew_members
  for each row execute function public.trg_notify_verified();

-- Evento novo -> membros da equipe (menos quem criou)
create or replace function public.trg_notify_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record; v_crew text;
begin
  select name into v_crew from public.crews where id = new.crew_id;
  for m in select user_id from public.crew_members where crew_id = new.crew_id and user_id <> new.created_by loop
    perform public.notify(m.user_id, 'evento', 'eventos', 'Evento novo: ' || new.title,
      v_crew || ' · ' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"MI'), '/evento/' || new.id);
  end loop;
  return new;
end $$;
create trigger notify_event after insert on public.events
  for each row execute function public.trg_notify_event();

-- Comentário no meu post
create or replace function public.trg_notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author text;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  if v_author is not null and v_author <> new.author_id then
    perform public.notify(v_author, 'comentario', 'social',
      '@' || (select username from public.profiles where id = new.author_id) || ' comentou no seu post',
      left(new.body, 140), '/post/' || new.post_id);
  end if;
  return new;
end $$;
create trigger notify_comment after insert on public.post_comments
  for each row execute function public.trg_notify_comment();

-- Alguém entrou com o meu convite
create or replace function public.trg_notify_invite_used()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.used_by is not null and old.used_by is null then
    perform public.notify(new.created_by, 'convite_usado', 'social',
      '@' || coalesce((select username from public.profiles where id = new.used_by), 'alguém') || ' entrou com o seu convite',
      'Você é o padrinho: ajude a pessoa a achar a equipe dela.', null);
  end if;
  return new;
end $$;
create trigger notify_invite_used after update on public.invites
  for each row execute function public.trg_notify_invite_used();

-- ---------------------------------------------------------------------------
-- 3) Privacidade: baixar meus dados e apagar minha conta
-- ---------------------------------------------------------------------------
create or replace function public.my_data_export()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  return jsonb_build_object(
    'gerado_em', now(),
    'perfil', (select to_jsonb(p) - 'is_master' from public.profiles p where p.id = v_uid),
    'carros', coalesce((select jsonb_agg(to_jsonb(c)) from public.cars c where c.owner_id = v_uid), '[]'),
    'equipes', coalesce((select jsonb_agg(jsonb_build_object('equipe', cr.name, 'papel', m.role, 'status', m.status,
                                                             'desde', m.joined_at))
                           from public.crew_members m join public.crews cr on cr.id = m.crew_id where m.user_id = v_uid), '[]'),
    'posts', coalesce((select jsonb_agg(jsonb_build_object('texto', x.body, 'foto', x.photo_key, 'em', x.created_at))
                         from public.posts x where x.author_id = v_uid), '[]'),
    'comentarios', coalesce((select jsonb_agg(jsonb_build_object('texto', x.body, 'em', x.created_at))
                               from public.post_comments x where x.author_id = v_uid), '[]'),
    'avisos_no_mapa', coalesce((select jsonb_agg(jsonb_build_object('tipo', r.kind, 'lat', r.lat, 'lon', r.lon, 'em', r.created_at))
                                  from public.reports r where r.author_id = v_uid), '[]'),
    'presencas_em_eventos', coalesce((select jsonb_agg(jsonb_build_object('evento', e.title, 'dia', e.starts_at))
                                        from public.event_rsvps v join public.events e on e.id = v.event_id
                                       where v.user_id = v_uid), '[]'),
    'zonas_privadas', coalesce((select jsonb_agg(to_jsonb(z) - 'user_id') from public.private_zones z where z.user_id = v_uid), '[]'),
    'historico_de_posicao', 'guardado só por pouco tempo para a equipe; não é exportado em detalhe'
  );
end $$;

-- Apaga a conta no Marcha GPS. Quem fundou equipe com outros membros precisa passar a equipe antes.
create or replace function public.delete_my_account(p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile(); v_username text;
begin
  select username into v_username from public.profiles where id = v_uid;
  if lower(btrim(coalesce(p_confirm, ''))) <> v_username then raise exception 'confirm_mismatch'; end if;
  if exists (select 1 from public.crew_members f
              where f.user_id = v_uid and f.role = 'founder'
                and exists (select 1 from public.crew_members o where o.crew_id = f.crew_id and o.user_id <> v_uid)) then
    raise exception 'founder_with_members';
  end if;
  -- equipes só dele somem junto
  delete from public.crews c
   where exists (select 1 from public.crew_members f where f.crew_id = c.id and f.user_id = v_uid and f.role = 'founder');
  -- eventos que ele criou em equipes de outros ficam com o fundador da equipe
  update public.events e
     set created_by = (select m.user_id from public.crew_members m where m.crew_id = e.crew_id and m.role = 'founder' limit 1)
   where e.created_by = v_uid;
  delete from public.events where created_by = v_uid; -- sobrou só o que não tinha fundador
  update public.crew_requests set reviewed_by = null where reviewed_by = v_uid;
  -- o resto (carros, posts, posições, pedidos, convites dele) sai junto com o perfil;
  -- convite que ele usou continua gasto (used_at fica)
  delete from public.profiles where id = v_uid;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Eventos: capa, descrição, local; painel com todos que a pessoa pode ver
-- ---------------------------------------------------------------------------
alter table public.events
  add column cover_key text check (cover_key is null or cover_key ~ '^[a-z]+/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  add column description text check (description is null or length(description) <= 1000),
  add column place_name text check (place_name is null or length(place_name) <= 160);

-- evento aberto aparece pra qualquer pessoa do app (é assim que gente nova acha a equipe)
drop policy events_read on public.events;
create policy events_read on public.events for select to authenticated
  using (
    public.is_crew_member(crew_id)
    or (visibility = 'open' and public.has_profile())
    or (visibility = 'invited' and exists (
          select 1 from public.event_guest_crews g
           where g.event_id = events.id and public.is_verified_in(g.crew_id)))
  );

-- a capa tem que ser foto da própria pessoa
create or replace function public.events_check_cover()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cover_key is not null and (tg_op = 'INSERT' or new.cover_key is distinct from old.cover_key)
     and not public.check_own_photo_key(new.cover_key, auth.user_id()) then
    raise exception 'invalid_photo';
  end if;
  return new;
end $$;
create trigger events_check_cover before insert or update on public.events
  for each row execute function public.events_check_cover();

create or replace function public.events_board(p_scope text default 'todos')
returns table (id uuid, title text, starts_at timestamptz, ends_at timestamptz, cover_key text, description text,
               place_name text, lat double precision, lon double precision, crew_id uuid, crew_name text, crew_color text,
               crew_avatar text, city text, visibility text, going integer, i_am_going boolean, i_am_member boolean,
               my_join_request text)
language sql stable security definer set search_path = public as $$
  -- roda com a regra de quem pode ver (events_read) aplicada à mão, porque a função é security definer
  select e.id, e.title, e.starts_at, e.ends_at, e.cover_key, e.description, e.place_name, e.lat, e.lon,
         c.id, c.name, c.color, c.avatar_key, ci.name, e.visibility,
         (select count(*)::int from public.event_rsvps r where r.event_id = e.id),
         exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = auth.user_id()),
         public.is_crew_member(c.id),
         (select r.status from public.crew_join_requests r
           where r.crew_id = c.id and r.user_id = auth.user_id() order by r.created_at desc limit 1)
    from public.events e
    join public.crews c on c.id = e.crew_id
    join public.cities ci on ci.id = c.city_id
   where public.has_profile() and e.ends_at > now() and c.status = 'active'
     and (public.is_crew_member(e.crew_id)
          or e.visibility = 'open'
          or (e.visibility = 'invited' and exists (select 1 from public.event_guest_crews g
                                                    where g.event_id = e.id and public.is_verified_in(g.crew_id))))
     and (p_scope = 'todos' or (p_scope = 'minhas' and public.is_crew_member(e.crew_id))
          or (p_scope = 'vou' and exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = auth.user_id())))
   order by e.starts_at
   limit 100;
$$;

create or replace function public.event_detail(p_event uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(b) from public.events_board('todos') b where b.id = p_event;
$$;

create or replace function public.set_rsvp(p_event uuid, p_going boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare v_uid text := public.require_profile();
begin
  if not exists (select 1 from public.events_board('todos') b where b.id = p_event) then raise exception 'event_not_found'; end if;
  if p_going then
    insert into public.event_rsvps (event_id, user_id) values (p_event, v_uid) on conflict do nothing;
  else
    delete from public.event_rsvps where event_id = p_event and user_id = v_uid;
  end if;
  return (select count(*)::int from public.event_rsvps where event_id = p_event);
end $$;

-- ---------------------------------------------------------------------------
-- 5) Descobrir equipes: capa, bio, fundador, próximo evento
-- ---------------------------------------------------------------------------
drop function public.crew_directory();
create function public.crew_directory()
returns table (id uuid, name text, city text, color text, avatar_key text, cover_key text, bio text, instagram text,
               founder text, member_count integer, next_event timestamptz, i_am_member boolean, my_request text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, ci.name, c.color, c.avatar_key, c.cover_key, c.bio, c.instagram,
         (select p.username from public.crew_members m join public.profiles p on p.id = m.user_id
           where m.crew_id = c.id and m.role = 'founder' limit 1),
         (select count(*)::int from public.crew_members m where m.crew_id = c.id and m.status = 'verified'),
         (select min(e.starts_at) from public.events e where e.crew_id = c.id and e.ends_at > now() and e.visibility = 'open'),
         public.is_crew_member(c.id, public.require_profile()),
         (select r.status from public.crew_join_requests r
           where r.crew_id = c.id and r.user_id = auth.user_id() order by r.created_at desc limit 1)
    from public.crews c join public.cities ci on ci.id = c.city_id
   where c.status = 'active'
   order by (select count(*) from public.crew_members m where m.crew_id = c.id and m.status = 'verified') desc, c.name;
$$;

-- ---------------------------------------------------------------------------
revoke execute on function public.set_my_profile(text, text), public.set_notify_prefs(boolean, boolean, boolean),
  public.my_notifications(integer), public.unread_notifications(), public.mark_notifications_read(uuid[]),
  public.my_data_export(), public.delete_my_account(text), public.events_board(text), public.event_detail(uuid),
  public.set_rsvp(uuid, boolean), public.crew_directory() from public, anonymous;
grant execute on function public.set_my_profile(text, text), public.set_notify_prefs(boolean, boolean, boolean),
  public.my_notifications(integer), public.unread_notifications(), public.mark_notifications_read(uuid[]),
  public.my_data_export(), public.delete_my_account(text), public.events_board(text), public.event_detail(uuid),
  public.set_rsvp(uuid, boolean), public.crew_directory() to authenticated;
revoke execute on function public.my_profile(), public.public_profile(text) from public, anonymous;
grant execute on function public.my_profile(), public.public_profile(text) to authenticated;

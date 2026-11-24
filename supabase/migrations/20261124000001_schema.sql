-- Marcha GPS — tabelas
-- Coordenadas ficam em lat/lon (graus). Distâncias são calculadas com haversine_m().

-- ---------------------------------------------------------------------------
-- Cidades da área de lançamento
-- ---------------------------------------------------------------------------
create table public.cities (
  id        text primary key,
  name      text not null,
  priority  smallint not null,          -- caixas se sobrepõem na divisa: menor ganha
  lat_min   double precision not null,
  lat_max   double precision not null,
  lon_min   double precision not null,
  lon_max   double precision not null
);

insert into public.cities (id, name, priority, lat_min, lat_max, lon_min, lon_max) values
  ('itaquaquecetuba', 'Itaquaquecetuba', 1, -23.53, -23.40, -46.40, -46.30),
  ('guarulhos',       'Guarulhos',       2, -23.50, -23.29, -46.58, -46.32),
  ('sao_paulo',       'São Paulo',       3, -24.01, -23.35, -46.83, -46.36);

-- ---------------------------------------------------------------------------
-- Perfis (só existe perfil quem entrou por convite: ver redeem_invite)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  username          text not null unique check (username ~ '^[a-z0-9._]{3,24}$'),
  is_master         boolean not null default false,
  invites_left      integer not null default 0 check (invites_left >= 0),
  invited_by        uuid references public.profiles (id) on delete set null,
  -- visibilidade no mapa
  visibility        text not null default 'ghost' check (visibility in ('ghost', 'crew', 'scene')),
  precise_for_scene boolean not null default false,  -- false = mostra só a região (~500 m) pra quem não é da equipe
  delay_minutes     integer not null default 0 check (delay_minutes in (0, 2, 5)),
  created_at        timestamptz not null default now()
);

create table public.private_zones (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles (id) on delete cascade,
  label     text not null default 'Casa',
  lat       double precision not null check (lat between -90 and 90),
  lon       double precision not null check (lon between -180 and 180),
  radius_m  integer not null default 1000 check (radius_m between 300 and 3000)
);
create index on public.private_zones (user_id);

-- ---------------------------------------------------------------------------
-- Equipes
-- ---------------------------------------------------------------------------
create table public.crews (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  city_id       text not null references public.cities (id),
  instagram     text,
  color         text not null default '#C6FF3D' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  button_shape  text not null default 'reto' check (button_shape in ('redondo', 'reto', 'quadrado')),
  status        text not null default 'active' check (status in ('active', 'suspended')),
  created_at    timestamptz not null default now()
);

create table public.crew_members (
  crew_id      uuid not null references public.crews (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('founder', 'admin', 'member')),
  status       text not null default 'pending' check (status in ('pending', 'verified')),
  sponsor_id   uuid references public.profiles (id) on delete set null,  -- padrinho
  xp           integer not null default 0 check (xp >= 0),
  joined_at    timestamptz not null default now(),
  verified_at  timestamptz,
  primary key (crew_id, user_id)
);
create index on public.crew_members (user_id);

-- crew_id nulo = convite de fundador, só o Adm Master cria
create table public.invites (
  code        text primary key,
  crew_id     uuid references public.crews (id) on delete cascade,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  used_by     uuid references public.profiles (id) on delete set null,
  used_at     timestamptz,
  expires_at  timestamptz not null default now() + interval '7 days',
  created_at  timestamptz not null default now()
);

-- Verificação: 2 membros confirmam que conhecem + 1 check-in presencial feito por admin
create table public.member_vouches (
  crew_id     uuid not null,
  member_id   uuid not null,
  voucher_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (crew_id, member_id, voucher_id),
  check (member_id <> voucher_id),
  foreign key (crew_id, member_id) references public.crew_members (crew_id, user_id) on delete cascade
);

create table public.member_checkins (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null,
  member_id   uuid not null,
  admin_id    uuid not null references public.profiles (id) on delete cascade,
  event_id    uuid,
  created_at  timestamptz not null default now(),
  foreign key (crew_id, member_id) references public.crew_members (crew_id, user_id) on delete cascade
);

-- Pedido de equipe nova, analisado pelo Adm Master
create table public.crew_requests (
  id                  uuid primary key default gen_random_uuid(),
  requester_id        uuid not null references public.profiles (id) on delete cascade,
  name                text not null check (length(name) between 2 and 40),
  city_id             text not null references public.cities (id),
  instagram           text,
  member_count        integer not null check (member_count > 0),
  proof_paths         text[] not null default '{}',
  accepts_video_call  boolean not null default false,
  status              text not null default 'pending' check (status in ('pending', 'more_info', 'approved', 'rejected')),
  master_note         text,
  reviewed_by         uuid references public.profiles (id),
  reviewed_at         timestamptz,
  crew_id             uuid references public.crews (id),
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Carros (garagem)
-- ---------------------------------------------------------------------------
create table public.cars (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  make            text not null,
  model           text not null,
  year            integer check (year between 1950 and 2100),
  color           text not null default '#B9C0CB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  ride_height_cm  integer not null default 15 check (ride_height_cm between 0 and 40),
  suspension      text not null default 'original' check (suspension in ('original', 'fixa', 'rosca', 'ar')),
  rim             integer not null default 15 check (rim between 13 and 22),
  wheel_position  text not null default 'alinhada' check (wheel_position in ('dentro', 'alinhada', 'fora')),
  camber_deg      numeric(3,1) not null default 0 check (camber_deg between 0 and 8),
  tint            text not null default 'nenhuma' check (tint in ('nenhuma', 'fume', 'limo')),
  spoiler         boolean not null default false,
  neon            text check (neon in ('verde', 'azul', 'roxo')),
  photo_paths     text[] not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index cars_one_active_per_owner on public.cars (owner_id) where is_active;

-- ---------------------------------------------------------------------------
-- Eventos e "fazer a mídia"
-- ---------------------------------------------------------------------------
create table public.events (
  id             uuid primary key default gen_random_uuid(),
  crew_id        uuid not null references public.crews (id) on delete cascade,
  kind           text not null check (kind in ('encontro', 'role', 'pista')),
  title          text not null check (length(title) between 2 and 60),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  lat            double precision not null,
  lon            double precision not null,
  dest_lat       double precision,
  dest_lon       double precision,
  radius_m       integer not null default 200 check (radius_m between 50 and 2000),
  visibility     text not null default 'crew' check (visibility in ('crew', 'invited', 'open')),
  verified_only  boolean not null default true,
  created_by     uuid not null references public.profiles (id),
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.events (crew_id, starts_at);

create table public.event_guest_crews (
  event_id  uuid not null references public.events (id) on delete cascade,
  crew_id   uuid not null references public.crews (id) on delete cascade,
  primary key (event_id, crew_id)
);

create table public.event_media (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  photo_path  text not null,
  lat         double precision not null,
  lon         double precision not null,
  car_match   boolean,                    -- preenchido depois pela checagem de IA
  status      text not null default 'accepted' check (status in ('accepted', 'contested')),
  created_at  timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Avisos da comunidade (Radar) e pontos
-- ---------------------------------------------------------------------------
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('buraco', 'lombada', 'valeta', 'rua_ruim', 'rampa', 'radar',
                                              'blitz', 'alagamento', 'sonorizador', 'faixa_elevada')),
  lat           double precision not null,
  lon           double precision not null,
  city_id       text not null references public.cities (id),
  source        text not null default 'user' check (source in ('user', 'osm', 'antt')),
  source_ref    text,
  author_id     uuid references public.profiles (id) on delete set null,
  status        text not null default 'unconfirmed' check (status in ('unconfirmed', 'confirmed', 'rejected', 'expired')),
  base_risk     smallint not null default 2 check (base_risk between 0 and 3),
  speed_limit   integer,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);
create index on public.reports (status, lat, lon);
create unique index reports_source_ref on public.reports (source, source_ref) where source_ref is not null;

create table public.report_votes (
  report_id    uuid not null references public.reports (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  exists_vote  boolean not null,                -- true = o obstáculo está lá
  clearance    text check (clearance in ('passa', 'raspa', 'nao_passa')),
  created_at   timestamptz not null default now(),
  primary key (report_id, user_id)
);

create table public.points_ledger (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  delta       integer not null,
  reason      text not null check (reason in ('report_confirmed', 'confirmed_other', 'false_report')),
  report_id   uuid references public.reports (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (user_id, report_id, reason)
);
create index on public.points_ledger (user_id);

-- ---------------------------------------------------------------------------
-- Localização (ninguém lê direto: só pela função visible_cars)
-- ---------------------------------------------------------------------------
create table public.live_locations (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  lat             double precision not null,
  lon             double precision not null,
  heading         smallint check (heading between 0 and 359),
  active_crew_id  uuid references public.crews (id) on delete set null,
  updated_at      timestamptz not null default now()
);

-- guarda só os últimos 15 minutos (pra mostrar posição com atraso)
create table public.location_history (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  lat          double precision not null,
  lon          double precision not null,
  recorded_at  timestamptz not null default now()
);
create index on public.location_history (user_id, recorded_at desc);

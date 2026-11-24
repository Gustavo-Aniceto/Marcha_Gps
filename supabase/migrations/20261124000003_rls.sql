-- Marcha GPS — regras de acesso (RLS)
-- Padrão: o app lê pelas policies abaixo e escreve pelas funções.

alter table public.cities            enable row level security;
alter table public.profiles          enable row level security;
alter table public.private_zones     enable row level security;
alter table public.crews             enable row level security;
alter table public.crew_members      enable row level security;
alter table public.invites           enable row level security;
alter table public.member_vouches    enable row level security;
alter table public.member_checkins   enable row level security;
alter table public.crew_requests     enable row level security;
alter table public.cars              enable row level security;
alter table public.events            enable row level security;
alter table public.event_guest_crews enable row level security;
alter table public.event_media       enable row level security;
alter table public.reports           enable row level security;
alter table public.report_votes      enable row level security;
alter table public.points_ledger     enable row level security;
alter table public.live_locations    enable row level security;
alter table public.location_history  enable row level security;

-- Visitante sem login não vê nada
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Por padrão o usuário logado só lê; escrita direta é liberada tabela a tabela
revoke insert, update, delete on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;

-- cidades -------------------------------------------------------------------
create policy cities_read on public.cities for select to authenticated using (true);

-- perfis --------------------------------------------------------------------
create policy profiles_read on public.profiles for select to authenticated
  using (public.has_profile());
-- só os campos de preferência podem ser mudados pelo próprio usuário
grant update (visibility, precise_for_scene, delay_minutes) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- zonas privadas: só a própria pessoa -----------------------------------------
grant insert, update, delete on public.private_zones to authenticated;
create policy zones_own on public.private_zones for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_profile());

-- equipes -------------------------------------------------------------------
create policy crews_read on public.crews for select to authenticated
  using (public.has_profile());

create policy members_read on public.crew_members for select to authenticated
  using (user_id = auth.uid() or public.is_crew_member(crew_id));

-- convites: quem criou vê os seus; o Adm Master vê todos
create policy invites_read on public.invites for select to authenticated
  using (created_by = auth.uid() or public.is_master());

create policy vouches_read on public.member_vouches for select to authenticated
  using (public.is_crew_member(crew_id));
create policy checkins_read on public.member_checkins for select to authenticated
  using (public.is_crew_member(crew_id));

-- pedidos de equipe: a pessoa cria e acompanha o seu; o Adm Master vê todos
grant insert on public.crew_requests to authenticated;
create policy requests_insert on public.crew_requests for insert to authenticated
  with check (requester_id = auth.uid() and public.has_profile() and status = 'pending'
              and reviewed_by is null and crew_id is null and master_note is null);
create policy requests_read on public.crew_requests for select to authenticated
  using (requester_id = auth.uid() or public.is_master());

-- carros --------------------------------------------------------------------
grant insert, update, delete on public.cars to authenticated;
create policy cars_read on public.cars for select to authenticated
  using (public.has_profile());
create policy cars_write_own on public.cars for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.has_profile());

-- eventos -------------------------------------------------------------------
grant insert, update, delete on public.events to authenticated;
create policy events_read on public.events for select to authenticated
  using (
    public.is_crew_member(crew_id)
    or (visibility = 'open' and public.is_verified_anywhere())
    or (visibility = 'invited' and exists (
          select 1 from public.event_guest_crews g
           where g.event_id = events.id and public.is_verified_in(g.crew_id)))
  );
create policy events_admin_write on public.events for all to authenticated
  using (public.is_crew_admin(crew_id))
  with check (public.is_crew_admin(crew_id) and created_by = auth.uid());

grant insert, delete on public.event_guest_crews to authenticated;
create policy guests_read on public.event_guest_crews for select to authenticated
  using (public.is_crew_member(crew_id) or public.is_crew_member(public.event_crew_id(event_id)));
create policy guests_admin_write on public.event_guest_crews for all to authenticated
  using (public.is_crew_admin(public.event_crew_id(event_id)))
  with check (public.is_crew_admin(public.event_crew_id(event_id)));

create policy media_read on public.event_media for select to authenticated
  using (public.is_crew_member(public.event_crew_id(event_id)));

-- radar ---------------------------------------------------------------------
create policy reports_read on public.reports for select to authenticated
  using (public.has_profile() and status in ('unconfirmed', 'confirmed')
         and (expires_at is null or expires_at > now()));

create policy votes_read_own on public.report_votes for select to authenticated
  using (user_id = auth.uid());

create policy points_read_own on public.points_ledger for select to authenticated
  using (user_id = auth.uid());

-- localização: só a própria linha. Os outros só aparecem via visible_cars().
create policy live_read_own on public.live_locations for select to authenticated
  using (user_id = auth.uid());
create policy history_read_own on public.location_history for select to authenticated
  using (user_id = auth.uid());

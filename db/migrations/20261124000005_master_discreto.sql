-- Marcha GPS — Adm Master discreto
-- Só donos de equipe (fundadores verificados) sabem quem é o Adm Master.
-- Por isso o perfil dos outros só mostra id, nome de usuário, padrinho e data;
-- os dados do próprio perfil vêm por my_profile().

revoke select on public.profiles from authenticated;
grant select (id, username, invited_by, created_at) on public.profiles to authenticated;

-- quem analisou o pedido de equipe também não aparece pra quem pediu
revoke select on public.crew_requests from authenticated;
grant select (id, requester_id, name, city_id, instagram, member_count, proof_paths, accepts_video_call,
              status, master_note, reviewed_at, crew_id, created_at)
  on public.crew_requests to authenticated;

create or replace function public.my_profile()
returns table (id text, username text, is_master boolean, invites_left integer,
               visibility text, precise_for_scene boolean, delay_minutes integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.is_master, p.invites_left, p.visibility, p.precise_for_scene, p.delay_minutes
    from public.profiles p
   where p.id = auth.user_id();
$$;

create or replace function public.is_founder_anywhere(p_uid text default auth.user_id())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew_members cm join public.crews c on c.id = cm.crew_id
                 where cm.user_id = p_uid and cm.role = 'founder' and cm.status = 'verified'
                   and c.status = 'active');
$$;

-- Contato do Adm Master: só pra fundadores (e o próprio master). Pros outros volta vazio.
create or replace function public.master_contact()
returns table (username text)
language sql stable security definer set search_path = public as $$
  select p.username from public.profiles p
   where p.is_master
     and (public.is_founder_anywhere() or public.is_master())
   order by p.created_at;
$$;

revoke execute on function public.my_profile(), public.is_founder_anywhere(text), public.master_contact()
  from public, anonymous;
grant execute on function public.my_profile(), public.master_contact() to authenticated;

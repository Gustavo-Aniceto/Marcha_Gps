-- Marcha GPS — convite (principalmente o de fundador) vale UMA vez só, pra sempre.
-- Antes, se a conta de quem usou fosse apagada, used_by virava nulo (on delete set null) e o código voltava a valer.
-- Agora conta também used_at, que nunca é apagado.

create or replace function public.redeem_invite(p_code text, p_username text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid text := auth.user_id();
  v_inv public.invites;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_inv from public.invites where code = upper(trim(p_code)) for update;
  if not found then raise exception 'invite_not_found'; end if;
  if v_inv.used_by is not null or v_inv.used_at is not null then raise exception 'invite_used'; end if;
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

create or replace function public.check_invite(p_code text)
returns table (status text, kind text, crew_name text)
language plpgsql stable security definer set search_path = public as $$
declare v public.invites;
begin
  if p_code is null or upper(trim(p_code)) !~ '^[0-9A-F]{4}-[0-9A-F]{4}$' then
    return query select 'nao_existe'::text, null::text, null::text; return;
  end if;
  select * into v from public.invites where code = upper(trim(p_code));
  if not found then return query select 'nao_existe'::text, null::text, null::text; return; end if;
  if v.used_by is not null or v.used_at is not null then return query select 'usado'::text, null::text, null::text; return; end if;
  if v.expires_at < now() then return query select 'vencido'::text, null::text, null::text; return; end if;
  return query
    select 'ok'::text,
           case when v.crew_id is null then 'fundador' else 'equipe' end,
           (select c.name from public.crews c where c.id = v.crew_id);
end $$;

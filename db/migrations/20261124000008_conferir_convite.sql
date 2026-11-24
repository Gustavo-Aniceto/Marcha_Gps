-- Marcha GPS — o convite vem antes do login.
-- Quem ainda não tem conta digita o código primeiro; o app confere aqui (sem login) e só então
-- manda pra tela de entrar com Google, Apple, Facebook ou e-mail. O uso de verdade do convite
-- continua sendo redeem_invite(), já logado.

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
  if v.used_by is not null then return query select 'usado'::text, null::text, null::text; return; end if;
  if v.expires_at < now() then return query select 'vencido'::text, null::text, null::text; return; end if;
  return query
    select 'ok'::text,
           case when v.crew_id is null then 'fundador' else 'equipe' end,
           (select c.name from public.crews c where c.id = v.crew_id);
end $$;

revoke execute on function public.check_invite(text) from public;
grant execute on function public.check_invite(text) to anonymous, authenticated;

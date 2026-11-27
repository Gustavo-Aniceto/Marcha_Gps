-- Marcha GPS — login sai do Clerk e vai pro Neon Auth (Better Auth gerenciado pelo Neon).
-- O id do usuário continua vindo do token (claim sub), agora um uuid em texto.
-- Contas antigas (id do Clerk "user_...") são reconectadas no primeiro login com o MESMO e-mail
-- verificado: o id antigo vira o novo em todas as tabelas (FKs com ON UPDATE CASCADE).

-- 1) Contas antigas esperando reconexão. Os e-mails são preenchidos direto no banco (fora do repositório).
create table public.legacy_logins (
  old_id     text primary key,
  email      text not null,
  new_id     text unique,
  claimed_at timestamptz
);
create unique index legacy_logins_email on public.legacy_logins (lower(email));
alter table public.legacy_logins enable row level security;
-- sem policies: só as funções abaixo (security definer) leem
revoke all on public.legacy_logins from public, anonymous, authenticated;

-- 2) Toda FK pra profiles(id) passa a atualizar em cascata (pra trocar o id antigo pelo novo de uma vez)
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, a.attname as col,
           case c.confdeltype when 'c' then 'cascade' when 'n' then 'set null' when 'r' then 'restrict'
                              when 'd' then 'set default' else 'no action' end as on_delete
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass and array_length(c.conkey, 1) = 1
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on update cascade on delete %s',
                   r.tbl, r.conname, r.col, r.on_delete);
  end loop;
end $$;

-- 3) Reconecta a conta antiga. O app chama logo depois do login quando my_profile() volta vazio.
--    Só com e-mail verificado (Google ou código no e-mail) e só se a pessoa ainda não tem perfil novo.
create or replace function public.claim_legacy_account()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid text := public.current_uid();
  v_email text; v_verified boolean; v_old text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then return 'ja_tem'; end if;
  if to_regclass('neon_auth.user') is null then return 'nada'; end if;
  execute 'select email, "emailVerified" from neon_auth."user" where id::text = $1'
     into v_email, v_verified using v_uid;
  if v_email is null or not coalesce(v_verified, false) then return 'nada'; end if;

  select old_id into v_old from public.legacy_logins
   where lower(email) = lower(v_email) and new_id is null
   for update;
  if v_old is null or not exists (select 1 from public.profiles where id = v_old) then return 'nada'; end if;

  update public.profiles set id = v_uid where id = v_old;              -- cascata leva tudo junto
  update public.content_reports set target_id = v_uid                  -- denúncia de perfil guarda o id em texto
   where target_type = 'profile' and target_id = v_old;
  update public.legacy_logins set new_id = v_uid, claimed_at = now() where old_id = v_old;
  return 'recuperada';
end $$;
revoke execute on function public.claim_legacy_account() from public, anonymous;
grant execute on function public.claim_legacy_account() to authenticated;

-- 4) Foto antiga (chave com o id do Clerk) continua sendo da pessoa depois da reconexão
create or replace function public.check_own_photo_key(p_key text, p_uid text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_key ~ '^[a-z]+/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.(jpg|png|webp)$'
     and (split_part(p_key, '/', 2) = p_uid
          or exists (select 1 from public.legacy_logins l where l.new_id = p_uid and l.old_id = split_part(p_key, '/', 2)));
$$;
revoke execute on function public.check_own_photo_key(text, text) from public, anonymous;

-- 5) Apagar a conta apaga também o login (fica no próprio banco, schema neon_auth)
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
  delete from public.crews c
   where exists (select 1 from public.crew_members f where f.crew_id = c.id and f.user_id = v_uid and f.role = 'founder');
  update public.events e
     set created_by = (select m.user_id from public.crew_members m where m.crew_id = e.crew_id and m.role = 'founder' limit 1)
   where e.created_by = v_uid;
  delete from public.events where created_by = v_uid;
  update public.crew_requests set reviewed_by = null where reviewed_by = v_uid;
  delete from public.profiles where id = v_uid;
  delete from public.legacy_logins where new_id = v_uid;
  -- login (sessões e contas do Google saem junto, em cascata no neon_auth)
  if to_regclass('neon_auth.user') is not null then
    execute 'delete from neon_auth."user" where id::text = $1' using v_uid;
  end if;
end $$;

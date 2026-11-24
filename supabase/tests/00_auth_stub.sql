-- Imitação mínima do Supabase pra rodar os testes num Postgres comum.
-- NÃO aplicar no Supabase de verdade.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Ajudantes dos testes
create schema if not exists t;
create or replace function t.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if c is not true then raise exception 'FALHOU: %', msg; end if;
end $$;
create or replace function t.throws(q text, expected text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'FALHOU: esperava erro "%" em: %', expected, q;
exception when others then
  if sqlerrm like 'FALHOU:%' then raise; end if;
  if position(expected in sqlerrm) = 0 then
    raise exception 'FALHOU: esperava "%" mas veio "%" em: %', expected, sqlerrm, q;
  end if;
end $$;
create or replace function t.login(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true);
$$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

-- Montagem rápida de cenário (chamar antes de "set role")
create or replace function t.crew(p_name text, p_city text default 'sao_paulo') returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.crews (name, city_id) values (p_name, p_city) returning id into v;
  return v;
end $$;
create or replace function t.user(p_id uuid, p_username text, p_crew uuid default null,
                                  p_status text default 'verified', p_role text default 'member') returns uuid
language plpgsql as $$
begin
  insert into auth.users (id) values (p_id) on conflict do nothing;
  insert into public.profiles (id, username) values (p_id, p_username) on conflict do nothing;
  if p_crew is not null then
    insert into public.crew_members (crew_id, user_id, role, status) values (p_crew, p_id, p_role, p_status);
  end if;
  return p_id;
end $$;

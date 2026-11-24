-- Imitação mínima do Neon (Data API + pg_session_jwt) pra rodar os testes num Postgres comum.
-- NÃO aplicar no Neon de verdade: lá o schema auth vem da Data API.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anonymous') then create role anonymous nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
create or replace function auth.user_id() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '');
$$;
grant usage on schema auth to anonymous, authenticated;
grant execute on function auth.user_id() to anonymous, authenticated;
grant usage on schema public to anonymous, authenticated;

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
create or replace function t.key() returns text language sql volatile as $$
  select 'media/' || auth.user_id() || '/' || gen_random_uuid()::text || '.jpg';
$$;
create or replace function t.login(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, true);
$$;
grant usage on schema t to anonymous, authenticated;
grant execute on all functions in schema t to anonymous, authenticated;

-- Montagem rápida de cenário (chamar antes de "set role")
create or replace function t.crew(p_name text, p_city text default 'sao_paulo') returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.crews (name, city_id) values (p_name, p_city) returning id into v;
  return v;
end $$;
create or replace function t.user(p_id text, p_username text, p_crew uuid default null,
                                  p_status text default 'verified', p_role text default 'member') returns text
language plpgsql as $$
begin
  insert into public.profiles (id, username) values (p_id, p_username) on conflict do nothing;
  if p_crew is not null then
    insert into public.crew_members (crew_id, user_id, role, status) values (p_crew, p_id, p_role, p_status);
  end if;
  return p_id;
end $$;

-- Funções que o app chama direto pela Data API sem passar o usuário (o padrão é o usuário logado).
-- O padrão fica gravado já resolvido, então funciona mesmo sem acesso ao schema auth (igual no Neon).
begin;
\set f 'user_fun000000000000000000f'
\set x 'user_fux000000000000000000x'
insert into public.profiles (id, username) values (:'f', 'funda.dor'), (:'x', 'xis.fora');
insert into public.crews (name, city_id) values ('Equipe Teste Fn', (select id from public.cities limit 1)) returning id as crew \gset
insert into public.crew_members (crew_id, user_id, role, status) values (:'crew', :'f', 'founder', 'verified');

set local role authenticated;
select t.login(:'f');
select t.ok(public.is_crew_admin(:'crew'), 'is_crew_admin sem usuário: fundador é admin');
select t.ok(public.is_crew_member(:'crew'), 'is_crew_member sem usuário');
select t.ok(public.is_verified_in(:'crew'), 'is_verified_in sem usuário');
select t.ok(public.is_verified_anywhere(), 'is_verified_anywhere sem usuário');
select t.ok(public.has_profile(), 'has_profile sem usuário');
select t.ok(not public.is_master(), 'is_master sem usuário');
select t.login(:'x');
select t.ok(not public.is_crew_admin(:'crew'), 'quem não é da equipe não é admin');
reset role;
rollback;

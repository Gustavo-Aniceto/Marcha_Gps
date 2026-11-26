-- Cargo Staff: entre membro e admin, nomeado pelo fundador
begin;

select t.crew('Equipe S') as cs \gset
select t.crew('Outra S') as co \gset
\set dono  'user_2donoS000000000000000s'
\set adm   'user_2admS0000000000000000s'
\set stf   'user_2stfS0000000000000000s'
\set memb  'user_2membS000000000000000s'
\set novo  'user_2novoS000000000000000s'
\set pend  'user_2pendS000000000000000s'
select t.user(:'dono', 'dono.s', :'cs', 'verified', 'founder');
select t.user(:'adm', 'adm.s', :'cs', 'verified', 'admin');
select t.user(:'stf', 'stf.s', :'cs', 'verified');
select t.user(:'memb', 'memb.s', :'cs', 'verified');
select t.user(:'novo', 'novo.s');
select t.user(:'pend', 'pend.s', :'cs', 'pending');

set local role authenticated;

-- ---------- quem nomeia ----------
select t.login(:'adm');
select t.throws(format($$ select public.set_member_role(%L, %L, 'staff') $$, :'cs', :'stf'), 'forbidden');
select t.login(:'dono');
select t.throws(format($$ select public.set_member_role(%L, %L, 'founder') $$, :'cs', :'stf'), 'invalid_role');
select t.throws(format($$ select public.set_member_role(%L, %L, 'staff') $$, :'cs', :'pend'), 'member_not_found');
select public.set_member_role(:'cs', :'stf', 'staff');
select t.ok((select role = 'staff' from public.crew_members where crew_id = :'cs' and user_id = :'stf'), 'fundador nomeou staff');

-- ---------- o que o staff pode ----------
select t.login(:'stf');
select t.ok(public.is_crew_staff(:'cs') and not public.is_crew_admin(:'cs'), 'staff não é admin');
select t.ok((select (j->>'i_am_staff')::boolean and not (j->>'i_am_admin')::boolean and j->>'my_role' = 'staff'
               from (select public.crew_page(:'cs') j) x), 'página diz que sou staff');
-- edita a página
select public.set_crew_page(:'cs', 'Bio da staff', 'equipe.s', null, null);
select t.ok((select bio = 'Bio da staff' from public.crews where id = :'cs'), 'staff edita a página');
-- não mexe no tema nem em cargos
select t.throws(format($$ select public.set_crew_theme(%L, '#3FA0FF', 'reto') $$, :'cs'), 'forbidden');
select t.throws(format($$ select public.set_member_role(%L, %L, 'staff') $$, :'cs', :'memb'), 'forbidden');

-- cria evento e mexe só no que criou
insert into public.events (crew_id, kind, title, starts_at, ends_at, lat, lon, created_by)
values (:'cs', 'encontro', 'Rolê da staff', now() + interval '1 day', now() + interval '1 day 3 hours', -23.46, -46.53, :'stf');
select id as ev_stf from public.events where title = 'Rolê da staff' \gset
update public.events set title = 'Rolê da staff 2' where id = :'ev_stf';
select t.ok((select title = 'Rolê da staff 2' from public.events where id = :'ev_stf'), 'staff edita o evento que criou');
-- evento de outra equipe não
select t.throws(format($$ insert into public.events (crew_id, kind, title, starts_at, ends_at, lat, lon, created_by)
                         values (%L, 'encontro', 'x', now() + interval '1 day', now() + interval '1 day 1 hour', -23.4, -46.5, %L) $$,
                       :'co', :'stf'), 'row-level security');

reset role;
insert into public.events (crew_id, kind, title, starts_at, ends_at, lat, lon, created_by)
values (:'cs', 'encontro', 'Evento do dono', now() + interval '2 day', now() + interval '2 day 3 hours', -23.46, -46.53, :'dono');
select id as ev_dono from public.events where title = 'Evento do dono' \gset
set local role authenticated;
select t.login(:'stf');
update public.events set title = 'hack' where id = :'ev_dono';
select t.ok((select title = 'Evento do dono' from public.events where id = :'ev_dono'), 'staff não mexe no evento dos outros');
delete from public.events where id = :'ev_dono';
select t.ok((select count(*) = 1 from public.events where id = :'ev_dono'), 'staff não apaga evento dos outros');
-- admin continua podendo apagar
select t.login(:'adm');
delete from public.events where id = :'ev_dono';
select t.ok((select count(*) = 0 from public.events where id = :'ev_dono'), 'admin apaga evento');

-- pedidos pra entrar: staff vê, é avisado e decide
select t.login(:'novo');
select public.request_join_crew(:'cs', 'oi') as jr \gset
select t.login(:'stf');
select t.ok((select count(*) = 1 from public.my_crews_join_requests()), 'staff vê o pedido');
select t.ok((select count(*) = 1 from public.crew_join_requests where id = :'jr'), 'staff lê o pedido na tabela');
select t.ok((select jsonb_array_length((public.crew_page(:'cs'))->'join_requests') = 1), 'página mostra o pedido pra staff');
reset role;
select t.ok((select count(*) = 1 from public.notifications where user_id = :'stf' and kind = 'pedido_entrar'), 'staff foi avisado');
set local role authenticated;
select t.login(:'stf');
select public.decide_join_request(:'jr', 'approved');
select t.ok((select status = 'pending' and sponsor_id = :'stf' from public.crew_members where crew_id = :'cs' and user_id = :'novo'), 'staff aprovou');

-- check-in de presença
select public.admin_checkin(:'cs', :'novo');
reset role;
select t.ok((select count(*) = 1 from public.member_checkins where crew_id = :'cs' and member_id = :'novo' and admin_id = :'stf'), 'staff fez check-in');
set local role authenticated;

-- membro comum continua sem poder
select t.login(:'memb');
select t.ok(not public.is_crew_staff(:'cs'), 'membro não é staff');
select t.throws(format($$ select public.set_crew_page(%L, 'x', null, null, null) $$, :'cs'), 'forbidden');
select t.throws(format($$ select public.admin_checkin(%L, %L) $$, :'cs', :'novo'), 'forbidden');

-- perfil mostra o cargo
select t.ok((select role = 'staff' from public.profile_crews('stf.s') where crew_id = :'cs'), 'perfil mostra staff');

-- fundador tira o staff
select t.login(:'dono');
select public.set_member_role(:'cs', :'stf', 'member');
select t.login(:'stf');
select t.ok(not public.is_crew_staff(:'cs'), 'voltou a membro');
select t.throws(format($$ select public.set_crew_page(%L, 'y', null, null, null) $$, :'cs'), 'forbidden');

rollback;

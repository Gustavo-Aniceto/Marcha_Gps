-- Vários carros, visibilidade por equipe, página da equipe, pedido de equipe e códigos de fundador
begin;

select t.crew('Equipe A') as ca \gset
select t.crew('Equipe B') as cb \gset
\set dono  'user_2donoAB000000000000000a'
\set so_a  'user_2soA000000000000000000a'
\set so_b  'user_2soB000000000000000000b'
\set fora  'user_2fora00000000000000000c'
\set mst   'user_2mst000000000000000000m'
select t.user(:'dono', 'dono.ab', :'ca', 'verified', 'founder');
insert into public.crew_members (crew_id, user_id, role, status) values (:'cb', :'dono', 'member', 'verified');
select t.user(:'so_a', 'so.a', :'ca');
select t.user(:'so_b', 'so.b', :'cb');
select t.user(:'fora', 'fora');
insert into public.profiles (id, username, is_master) values (:'mst', 'mestre', true);

set local role authenticated;

-- ---------- 1) vários carros ----------
select t.login(:'dono');
insert into public.cars (owner_id, make, model) values (:'dono', 'VW', 'Gol');
insert into public.cars (owner_id, make, model) values (:'dono', 'Chevrolet', 'Opala');
select t.ok((select count(*) = 2 from public.cars where owner_id = :'dono'), 'tem 2 carros');
select t.ok((select count(*) = 1 from public.cars where owner_id = :'dono' and is_active), 'só um no mapa');
select t.ok((select model = 'Gol' from public.cars where owner_id = :'dono' and is_active), 'o primeiro continua no mapa');
select public.set_active_car((select id from public.cars where owner_id = :'dono' and model = 'Opala'));
select t.ok((select model = 'Opala' from public.cars where owner_id = :'dono' and is_active), 'trocou pro Opala');
select t.ok((select car->>'model' = 'Opala' from public.public_profile('dono.ab')), 'perfil mostra o carro do momento');
select t.ok((select count(*) = 2 from public.profile_garage('dono.ab')), 'garagem no perfil lista os 2');
-- apagou o do mapa: o outro assume
delete from public.cars where owner_id = :'dono' and model = 'Opala';
select t.ok((select model = 'Gol' from public.cars where owner_id = :'dono' and is_active), 'apagou o do mapa, o outro assume');
insert into public.cars (owner_id, make, model) values (:'dono', 'a', 'b'), (:'dono', 'c', 'd'), (:'dono', 'e', 'f'), (:'dono', 'g', 'h');
select t.throws(format($$ insert into public.cars (owner_id, make, model) values (%L, 'x', 'y') $$, :'dono'), 'too_many_cars');
-- carro de outra pessoa não dá pra ativar
select t.login(:'so_a');
select t.throws(format($$ select public.set_active_car(%L) $$, (select id from public.cars where owner_id = :'dono' limit 1)), 'car_not_found');

-- ---------- 2) quem vê meu carro, por equipe ----------
select t.login(:'dono'); select public.update_my_location(-23.55, -46.63, 90);
select t.login(:'so_a'); select public.update_my_location(-23.56, -46.64);
select t.login(:'so_b'); select public.update_my_location(-23.57, -46.65);

-- todas as equipes: A e B veem o dono
select t.login(:'dono'); select public.set_my_visibility('crew', null);
select t.login(:'so_a');
select t.ok(exists (select 1 from public.visible_cars() where username = 'dono.ab' and same_crew), 'todas as equipes: A vê');
select t.ok((select crews = array[:'ca'::uuid] from public.visible_cars() where username = 'dono.ab'), 'diz em qual equipe estão juntos');
select t.login(:'so_b');
select t.ok(exists (select 1 from public.visible_cars() where username = 'dono.ab'), 'todas as equipes: B vê');

-- só a equipe A: B não vê
select t.login(:'dono'); select public.set_my_visibility('crew', :'ca');
select t.ok((select visibility_crew = :'ca'::uuid from public.my_visibility()), 'guardou a equipe escolhida');
select t.login(:'so_a');
select t.ok(exists (select 1 from public.visible_cars() where username = 'dono.ab'), 'só A: A vê');
select t.login(:'so_b');
select t.ok(not exists (select 1 from public.visible_cars() where username = 'dono.ab'), 'só A: B não vê');

-- fantasma: ninguém vê
select t.login(:'dono'); select public.set_my_visibility('ghost', null);
select t.login(:'so_a');
select t.ok(not exists (select 1 from public.visible_cars() where username = 'dono.ab'), 'fantasma: ninguém vê');

-- não dá pra escolher equipe de que não faz parte, nem equipe no modo cena
select t.login(:'so_a');
select t.throws(format($$ select public.set_my_visibility('crew', %L) $$, :'cb'), 'forbidden');
select t.throws(format($$ select public.set_my_visibility('scene', %L) $$, :'ca'), 'invalid_visibility');

-- ---------- 3) evento sem tipo ----------
select t.login(:'dono');
insert into public.events (crew_id, title, starts_at, ends_at, lat, lon, created_by)
values (:'ca', 'Encontro sem tipo', now() + interval '1 day', now() + interval '1 day 4 hours', -23.5, -46.6, :'dono');
select t.ok((select kind = 'encontro' from public.events where title = 'Encontro sem tipo'), 'evento sem tipo vira encontro');

-- ---------- 4) pedido de equipe ----------
-- dono de equipe não pede outra
select t.throws(format($$ insert into public.crew_requests (requester_id, name, city_id, member_count) values (%L, 'Outra', 'sao_paulo', 5) $$, :'dono'),
                'row-level security');
-- quem entrou com convite comum (sem código de fundador) não registra equipe
select t.login(:'fora');
select t.ok(not public.can_register_crew(), 'sem código de fundador não registra equipe');
select t.throws(format($$ insert into public.crew_requests (requester_id, name, city_id, member_count) values (%L, 'Sem Codigo', 'sao_paulo', 5) $$, :'fora'),
                'row-level security');
-- com código de fundador pede uma vez; segundo pedido em aberto não
select t.login(:'mst'); select public.create_invite('founder') as code_fora \gset
reset role;
update public.invites set used_by = :'fora', used_at = now() where code = :'code_fora';
set local role authenticated;
select t.login(:'fora');
select t.ok(public.can_register_crew(), 'com código de fundador pode registrar');
insert into public.crew_requests (requester_id, name, city_id, member_count) values (:'fora', 'Nova Equipe', 'sao_paulo', 5);
select t.throws(format($$ insert into public.crew_requests (requester_id, name, city_id, member_count) values (%L, 'De novo', 'sao_paulo', 5) $$, :'fora'),
                'row-level security');
-- o Adm Master também pode ter equipe
select t.login(:'mst');
insert into public.crew_requests (requester_id, name, city_id, member_count) values (:'mst', 'Equipe do Master', 'sao_paulo', 3);
select public.review_crew_request((select id from public.crew_requests where requester_id = :'mst'), 'approved');
select t.ok(exists (select 1 from public.profile_crews('mestre') where name = 'Equipe do Master' and role = 'founder'),
            'master também é fundador da própria equipe');

-- ---------- 5) página da equipe ----------
select t.login(:'fora');
select t.ok((select (public.crew_page(:'ca'))->>'name' = 'Equipe A'), 'página da equipe abre pra quem é de fora');
select t.ok((select ((public.crew_page(:'ca'))->>'member_count')::int = 2), 'conta só os verificados');
select t.ok((select (public.crew_page(:'ca'))->'founder'->>'username' = 'dono.ab'), 'mostra o fundador');
select t.ok((select jsonb_array_length((public.crew_page(:'ca'))->'events') = 0), 'evento só da equipe não aparece pra quem é de fora');
select t.login(:'so_a');
select t.ok((select jsonb_array_length((public.crew_page(:'ca'))->'events') = 1), 'membro vê o evento da equipe');
select t.ok((select count(*) = 2 from public.profile_crews('dono.ab')), 'perfil mostra as 2 equipes do dono');

-- ---------- 6) códigos de fundador fixos ----------
select t.login(:'mst');
select public.create_invite('founder') as code_f \gset
select t.ok((select expires_at = 'infinity' from public.invites where code = :'code_f'), 'código de fundador não vence');
select t.login('user_2novofund000000000000n');
select public.redeem_invite(:'code_f', 'novo.fundador');
insert into public.crew_requests (requester_id, name, city_id, member_count) values ('user_2novofund000000000000n', 'Equipe Nova', 'guarulhos', 8);
select t.login(:'mst');
select t.ok((select request_name = 'Equipe Nova' and request_status = 'pending' and crew_name is null
               from public.master_founder_codes() where code = :'code_f'), 'lista mostra o pedido em aberto do código');
select public.review_crew_request((select id from public.crew_requests where name = 'Equipe Nova'), 'approved');
select t.ok((select crew_name = 'Equipe Nova' and used_by = 'novo.fundador'
               from public.master_founder_codes() where code = :'code_f'), 'lista mostra a equipe que ficou com o código');
select t.login(:'so_a');
select t.throws($$ select * from public.master_founder_codes() $$, 'forbidden');

reset role;
rollback;

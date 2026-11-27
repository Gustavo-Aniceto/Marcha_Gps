-- O app vale em qualquer região: aviso fora das 3 cidades, equipe de qualquer cidade, importação por quadrado
begin;
\set u 'user_2regiao00000000000000r'
select t.user(:'u', 'regiao.r');

-- cidade pela posição: as 3 antigas continuam; o resto cai em "geral"
select t.ok(public.city_for(-23.55, -46.63) = 'sao_paulo', 'SP continua SP');
select t.ok(public.city_for(-22.90, -47.06) = 'geral', 'Campinas cai em geral');
select t.ok(public.city_for(-8.05, -34.90) = 'geral', 'Recife cai em geral');
select t.ok(public.city_slug('  São José dos Campos ') = 'sao_jose_dos_campos', 'slug da cidade');

set local role authenticated;
select t.login(:'u');
-- aviso do Radar em Recife
select t.ok(public.create_report('buraco', -8.05, -34.90, null) is not null, 'aviso fora de SP funciona');
select t.ok((select city_id = 'geral' from public.reports where author_id = :'u' limit 1), 'aviso de Recife fica em geral');

-- marca áreas (até 40 pontos)
select t.ok(public.mark_areas(array[-8.05, -8.06], array[-34.90, -34.91]) = 1, 'marca 1 quadrado');
select t.ok(public.mark_areas(array[-8.05], array[-34.90]) = 0, 'mesmo quadrado no mesmo dia não remarca');
select t.throws($$ select public.mark_areas(array[1.0], array[1.0, 2.0]) $$, 'invalid_points');
select t.throws($$ select public.osm_cells_due(3) $$, 'permission denied');
reset role;

select t.ok(public.area_cell(-8.05, -34.90) = 'g409_725', 'id do quadrado');
select t.ok((select count(*) = 1 from public.osm_cells_due(5)), 'quadrado pedido aparece pra importar');
select t.ok(public.osm_import_due('g409_725'), 'quadrado com número é aceito');
select t.ok((select count(*) = 0 from public.osm_cells_due(5)), 'depois de tentar, sai da fila por 50 min');
select t.ok(public.import_osm_obstacles('g409_725', E'node\t123\t-8.051\t-34.901\tbump\t\t\t') = 1, 'importa lombada em Recife');
select t.ok((select city_id = 'geral' from public.reports where source_ref = 'node/123'), 'lombada importada fica em geral');

-- pedido de equipe com cidade livre (o banco cria a cidade)
insert into public.crew_requests (requester_id, name, city_name, member_count) values (:'u', 'Turma de Campinas', ' Campinas ', 5);
select t.ok((select city_id = 'campinas' from public.crew_requests where requester_id = :'u'), 'pedido ganhou a cidade');
select t.ok((select name = 'Campinas' from public.cities where id = 'campinas'), 'cidade criada com o nome');
insert into public.crew_requests (requester_id, name, city_name, member_count) values (:'u', 'Outra', 'são paulo', 5);
select t.ok((select count(*) = 1 from public.cities where id = 'sao_paulo'), 'São Paulo digitado reaproveita a cidade');
select t.throws(format($$ insert into public.crew_requests (requester_id, name, city_name, member_count) values (%L, 'X', '123', 1) $$, :'u'), 'cidade_invalida');
insert into public.cities (id, name, priority) values ('x', 'x', 50);  -- só pra garantir que cidades sem caixa funcionam
select t.ok(public.city_for(10, 10) = 'geral', 'cidade sem caixa não atrapalha city_for');
rollback;

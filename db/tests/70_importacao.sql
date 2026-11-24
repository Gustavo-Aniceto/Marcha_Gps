-- Importação do OpenStreetMap: só o importador chama; mapeia tipos; não duplica
begin;

select E'node\t1\t-23.4500000\t-46.3500000\tbump\t\t\t\n'
    || E'node\t2\t-23.4500500\t-46.3500000\tbump\t\t\t\n'          -- 5 m do anterior: junta
    || E'way\t3\t-23.4600000\t-46.3600000\ttable;hump\t\t\t30\n'
    || E'node\t4\t-23.4700000\t-46.3700000\t\tspeed_camera\t\t60\n'
    || E'node\t5\t-23.4800000\t-46.3800000\tchicane\t\t\t\n'        -- não pega em carro baixo: ignora
    || E'node\t6\t-23.4900000\t-46.3900000\t\t\tbump\t\n'
    || E'node\t7\t-23.4910000\t-46.3910000\tdip\t\t\tabc\n'
    || E'lixo qualquer\n'
    || E'node\tx\t1\t2\tbump\t\t\t\n' as csv \gset

set local role authenticated;
select t.login('user_2qualquer0000000000000000');
select t.throws($$ select public.import_osm_obstacles('itaquaquecetuba', 'x') $$, 'permission denied');
reset role;

set local role importador;
select public.import_osm_obstacles('itaquaquecetuba', :'csv') as n1 \gset
select public.import_osm_obstacles('itaquaquecetuba', :'csv') as n2 \gset
reset role;
select t.ok(:n1 = 5, 'importa 5 pontos válidos');
select t.ok(:n2 = 0, 'rodar de novo não duplica');
select t.throws($$ select public.import_osm_obstacles('rio', 'x') $$, 'cidade_invalida');

select t.ok((select kind || ':' || base_risk from public.reports where source_ref = 'node/1') = 'lombada:3', 'bump vira lombada alta');
select t.ok(not exists (select 1 from public.reports where source_ref = 'node/2'), 'lombada repetida a 5 m some');
select t.ok((select kind || ':' || speed_limit from public.reports where source_ref = 'way/3') = 'faixa_elevada:30', 'table;hump pega o de maior risco');
select t.ok((select kind || ':' || base_risk || ':' || speed_limit from public.reports where source_ref = 'node/4') = 'radar:0:60', 'radar com velocidade');
select t.ok(not exists (select 1 from public.reports where source_ref = 'node/5'), 'chicane fica de fora');
select t.ok((select kind from public.reports where source_ref = 'node/6') = 'lombada', 'hazard=bump vira lombada');
select t.ok((select kind || ':' || coalesce(speed_limit::text, '-') from public.reports where source_ref = 'node/7') = 'valeta:-', 'dip vira valeta; velocidade ruim fica vazia');
select t.ok((select count(*) from public.reports where source = 'osm' and status = 'unconfirmed' and author_id is null) = 5, 'tudo entra sem autor e não confirmado');
select t.ok(not exists (select 1 from public.points_ledger), 'importar não dá ponto pra ninguém');

rollback;

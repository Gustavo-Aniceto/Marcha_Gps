-- Radar avisado com a velocidade; radar sem velocidade ganha a velocidade de quem confirma.
begin;
\set a 'user_radA000000000000000000a'
\set b 'user_radB000000000000000000b'
insert into public.profiles (id, username) values (:'a', 'radar.a'), (:'b', 'radar.b');
set local role authenticated;
select t.login(:'a');
select public.create_report('radar', -23.5600, -46.6500, 60) as r1 \gset
select t.ok((select speed_limit = 60 from public.reports where id = :'r1'), 'radar guarda a velocidade');
select t.throws($$ select public.create_report('radar', -23.57, -46.65, 65) $$, 'invalid_speed');
select t.throws($$ select public.create_report('lombada', -23.57, -46.65, 60) $$, 'invalid_speed');
select public.create_report('radar', -23.5800, -46.6500) as r2 \gset
select t.ok((select speed_limit is null from public.reports where id = :'r2'), 'radar sem velocidade');
select t.login(:'b');
select t.ok(public.create_report('radar', -23.58001, -46.6500, 50) = :'r2', 'mesmo radar vira voto');
select t.ok((select speed_limit = 50 from public.reports where id = :'r2'), 'quem confirma completa a velocidade');
select t.ok(public.create_report('radar', -23.56001, -46.6500, 80) = :'r1', 'voto no radar que já tem velocidade');
select t.ok((select speed_limit = 60 from public.reports where id = :'r1'), 'não troca velocidade já informada');
reset role;
rollback;

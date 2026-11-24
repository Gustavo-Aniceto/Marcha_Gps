-- Privacidade da localização: quem vê quem no mapa
begin;
\set v   '00000000-0000-0000-0000-000000000001'
\set t1  '00000000-0000-0000-0000-000000000011'
\set t2  '00000000-0000-0000-0000-000000000012'
\set t3  '00000000-0000-0000-0000-000000000013'
\set t4  '00000000-0000-0000-0000-000000000014'
\set t5  '00000000-0000-0000-0000-000000000015'
\set t6  '00000000-0000-0000-0000-000000000016'
\set t7  '00000000-0000-0000-0000-000000000017'
\set p   '00000000-0000-0000-0000-000000000099'

select t.crew('Low Família', 'guarulhos') as x \gset
select t.crew('Fixa Clube') as y \gset
select t.user(:'v',  'viewer',      :'x');
select t.user(:'t1', 'mesma.equipe', :'x');               -- mesma equipe, modo equipe
select t.user(:'t2', 'cena.aprox',   :'y');               -- outra equipe, cena, aproximado
select t.user(:'t3', 'fantasma',     :'y');               -- fantasma
select t.user(:'t4', 'zona.privada', :'y');               -- cena, mas está dentro da zona privada
select t.user(:'t5', 'parado',       :'y');               -- cena, parado há 20 min
select t.user(:'t6', 'cena.atraso',  :'y');               -- cena, exata, 2 min de atraso, em Guarulhos
select t.user(:'t7', 'so.equipe.y',  :'y');               -- outra equipe, modo só equipe
select t.user(:'p',  'pendente',     :'x', 'pending');    -- ainda não verificado

update public.profiles set visibility = 'crew'  where id in (:'t1', :'t7');
update public.profiles set visibility = 'scene' where id in (:'t2', :'t4', :'t5', :'t6');
update public.profiles set visibility = 'ghost' where id = :'t3';
update public.profiles set precise_for_scene = true, delay_minutes = 2 where id = :'t6';
insert into public.private_zones (user_id, lat, lon, radius_m) values (:'t4', -23.5000, -46.6000, 1000);
insert into public.cars (owner_id, make, model, color, ride_height_cm, rim)
values (:'t2', 'VW', 'Gol G5', '#B9C0CB', 8, 17);

set local role authenticated;
select t.login(:'t1'); select public.update_my_location(-23.5501, -46.6301, 90, :'x');
select t.login(:'t2'); select public.update_my_location(-23.5523, -46.6347, 45);
select t.login(:'t3'); select public.update_my_location(-23.5600, -46.6400);
select t.login(:'t4'); select public.update_my_location(-23.5040, -46.6030);
select t.login(:'t5'); select public.update_my_location(-23.5700, -46.6500);
select t.login(:'t6'); select public.update_my_location(-23.4600, -46.5300);
select t.login(:'t7'); select public.update_my_location(-23.5800, -46.6600);

reset role;
update public.live_locations set updated_at = now() - interval '20 minutes' where user_id = :'t5';
-- histórico do t6: 3 minutos atrás estava em outro ponto (ainda em Guarulhos)
insert into public.location_history (user_id, lat, lon, recorded_at) values (:'t6', -23.4400, -46.5100, now() - interval '3 minutes');
set local role authenticated;

select t.login(:'v');
create temp table seen on commit drop as select * from public.visible_cars();
select t.ok((select count(*) from seen) = 3, 'vê exatamente 3 carros (t1, t2, t6)');

select t.ok((select not approximate and same_crew and lat = -23.5501 and heading = 90 from seen where username = 'mesma.equipe'),
            'mesma equipe: posição exata');
select t.ok((select approximate and not same_crew and lat <> -23.5523 and heading is null from seen where username = 'cena.aprox'),
            'cena: posição aproximada e sem direção');
select t.ok((select abs(lat / 0.0045 - round(lat / 0.0045)) < 1e-9 from seen where username = 'cena.aprox'),
            'aproximada cai na grade de ~500 m');
select t.ok((select public.haversine_m(lat, lon, -23.5523, -46.6347) < 400 from seen where username = 'cena.aprox'),
            'aproximada fica perto da real');
select t.ok((select car->>'model' from seen where username = 'cena.aprox') = 'Gol G5', 'vem o carro montado');
select t.ok((select lat = -23.4400 and not approximate from seen where username = 'cena.atraso'),
            'atraso de 2 min mostra a posição antiga');
select t.ok(not exists (select 1 from seen where username in ('fantasma', 'zona.privada', 'parado', 'so.equipe.y', 'viewer')),
            'fantasma, zona privada, parado e só-equipe não aparecem');

-- filtro por cidade
select t.ok((select array_agg(username order by username) from public.visible_cars('guarulhos')) = array['cena.atraso'],
            'filtro Guarulhos');

-- ninguém lê a tabela de localização dos outros direto
select t.ok((select count(*) from public.live_locations) = 0, 'viewer não tem posição e não vê a dos outros');
select t.ok((select count(*) from public.location_history) = 0, 'histórico alheio invisível');
select t.throws($$ insert into public.live_locations (user_id, lat, lon) values (auth.uid(), 0, 0) $$, 'permission denied');

-- pendente não vê ninguém
select t.login(:'p');
select t.ok((select count(*) from public.visible_cars()) = 0, 'membro não verificado não vê o mapa da cena');

-- t1 some ao parar de compartilhar
select t.login(:'t1'); select public.stop_sharing_location();
select t.login(:'v');
select t.ok(not exists (select 1 from public.visible_cars() where username = 'mesma.equipe'), 'parou de compartilhar, sumiu');

rollback;

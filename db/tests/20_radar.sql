-- Avisos, confirmação pela comunidade e pontos do Radar
begin;
\set a '00000000-0000-0000-0000-0000000000a1'
\set b '00000000-0000-0000-0000-0000000000b1'
\set c '00000000-0000-0000-0000-0000000000c1'
\set d '00000000-0000-0000-0000-0000000000d1'
select t.user(:'a', 'membro.a'), t.user(:'b', 'membro.b'), t.user(:'c', 'membro.c'), t.user(:'d', 'membro.d');

set local role authenticated;

select t.login(:'a');
-- fora de SP / Guarulhos / Itaquá não pode
select t.throws($$ select public.create_report('lombada', -22.90, -43.20) $$, 'outside_area');
select public.create_report('lombada', -23.5500, -46.6300) as lomb \gset
select t.ok((select city_id from public.reports where id = :'lomb') = 'sao_paulo', 'cidade detectada');
select public.create_report('buraco', -23.45, -46.35) as itaqua \gset
select t.ok((select city_id from public.reports where id = :'itaqua') = 'itaquaquecetuba',
            'Itaquá ganha da caixa de Guarulhos na divisa');
select t.ok((select count(*) from public.points_ledger) = 0, 'criar aviso não dá ponto');
select t.throws(format($$ select public.vote_report(%L, true) $$, :'lomb'), 'cannot_vote_own_report');
-- não dá pra inserir aviso direto na tabela
select t.throws($$ insert into public.reports (kind, lat, lon, city_id) values ('radar', -23.5, -46.6, 'sao_paulo') $$,
                'permission denied');

-- B marca o mesmo lugar (8 m): vira voto, não aviso novo
select t.login(:'b');
select t.ok(public.create_report('lombada', -23.55007, -46.63000) = :'lomb', 'duplicado vira voto');
select t.ok((select count(*) from public.report_votes where report_id = :'lomb') = 1, 'voto do B registrado');

select t.login(:'c');
select t.ok(public.vote_report(:'lomb', true, 'raspa') = 'unconfirmed', '2 votos ainda não confirmam');
select t.login(:'d');
select t.ok(public.vote_report(:'lomb', true, 'nao_passa') = 'confirmed', '3º voto confirma');

reset role;
select t.ok((select sum(delta) from public.points_ledger where user_id = :'a') = 15, 'autor ganha 15 pela lombada');
select t.ok((select count(*) from public.points_ledger where reason = 'confirmed_other' and delta = 3) = 3,
            'cada um dos 3 que confirmaram ganha 3');
select t.ok((select expires_at from public.reports where id = :'lomb') is null, 'lombada confirmada não expira');
set local role authenticated;

-- aviso falso: 3 "não está lá" e o autor perde 5
select t.login(:'a');
select public.create_report('valeta', -23.5600, -46.6400) as fake \gset
select t.login(:'b'); select public.vote_report(:'fake', false);
select t.login(:'c'); select public.vote_report(:'fake', false);
select t.login(:'d'); select t.ok(public.vote_report(:'fake', false) = 'rejected', 'aviso falso rejeitado');
select t.ok((select count(*) from public.reports where id = :'fake') = 0, 'rejeitado some do mapa');

-- obstáculo removido: 3 votos "não está mais lá" depois de confirmado tiram do mapa
reset role;
update public.reports set confirmed_at = now() - interval '1 day' where id = :'lomb';
update public.report_votes set created_at = now() - interval '2 days' where report_id = :'lomb';
set local role authenticated;
select t.login(:'b'); select public.vote_report(:'lomb', false);
select t.login(:'c'); select public.vote_report(:'lomb', false);
select t.login(:'d'); select t.ok(public.vote_report(:'lomb', false) = 'expired', 'lombada tirada sai do mapa');

-- blitz expira em 1 hora
select t.login(:'b');
select public.create_report('blitz', -23.4600, -46.5300) as blitz \gset
reset role;
select t.ok((select city_id from public.reports where id = :'blitz') = 'guarulhos', 'blitz em Guarulhos');
select t.ok((select expires_at from public.reports where id = :'blitz') between now() + interval '59 minutes' and now() + interval '61 minutes',
            'blitz vale 1 hora');
update public.reports set expires_at = now() - interval '1 minute' where id = :'blitz';
select t.ok(public.expire_reports() >= 1, 'expire_reports marca vencidos');
set local role authenticated;
select t.ok((select count(*) from public.reports where id = :'blitz') = 0, 'blitz vencida some');

-- ranking geral
select t.ok((select points from public.radar_leaderboard() where username = 'membro.a') = 10, 'A: 15 - 5 = 10');
select t.ok((select rank_pos from public.radar_leaderboard() where username = 'membro.a') = 1, 'A em 1º');
select t.ok((select count(*) from public.points_ledger) = 1
            and not exists (select 1 from public.points_ledger where user_id <> auth.user_id()),
            'cada um só vê os próprios pontos (B tem só o +3)');

rollback;

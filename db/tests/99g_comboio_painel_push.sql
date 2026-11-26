-- Comboio, painel de números, Web Push e prévia do convite
begin;

select t.crew('Equipe C') as cc \gset
select t.crew('Outra C') as oc \gset
\set dono  'user_2donoC000000000000000c'
\set stf   'user_2stfC0000000000000000c'
\set memb  'user_2membC000000000000000c'
\set pend  'user_2pendC000000000000000c'
\set fora  'user_2foraC000000000000000c'
\set mst   'user_2mstC0000000000000000c'
select t.user(:'dono', 'dono.c', :'cc', 'verified', 'founder');
select t.user(:'stf', 'stf.c', :'cc', 'verified', 'staff');
select t.user(:'memb', 'memb.c', :'cc', 'verified');
select t.user(:'pend', 'pend.c', :'cc', 'pending');
select t.user(:'fora', 'fora.c', :'oc', 'verified');
select t.user(:'mst', 'mst.c');
update public.profiles set is_master = true where id = :'mst';
-- posições (memb está em casa, dentro da zona privada)
insert into public.live_locations (user_id, lat, lon) values
  (:'stf', -23.4600, -46.5300), (:'memb', -23.5000, -46.6000), (:'dono', -23.4610, -46.5310);
insert into public.private_zones (user_id, lat, lon, radius_m) values (:'memb', -23.5000, -46.6000, 500);
-- memb está no modo fantasma (padrão): mesmo assim aparece pra quem está no comboio
set local role authenticated;

-- ---------- comboio ----------
select t.login(:'memb');
select t.throws(format($$ select public.create_convoy(%L, 'Rolê', -23.4, -46.5) $$, :'cc'), 'forbidden');
select t.login(:'stf');
select t.throws(format($$ select public.create_convoy(%L, 'Rolê', 200, -46.5) $$, :'cc'), 'invalid_destination');
select public.create_convoy(:'cc', 'Rolê pro posto', -23.43, -46.48, 'Posto da Dutra') as cv \gset
select t.ok((select joined and members = 1 from public.my_convoys() where id = :'cv'), 'staff criou e já está dentro');
reset role;
select t.ok((select count(*) = 2 from public.notifications where kind = 'comboio' and user_id in (:'dono', :'memb')), 'equipe avisada');
select t.ok((select count(*) = 0 from public.notifications where kind = 'comboio' and user_id in (:'pend', :'fora', :'stf')), 'pendente, de fora e quem criou não');
set local role authenticated;

-- membro vê e entra; pendente e de fora não
select t.login(:'pend');
select t.ok((select count(*) = 0 from public.my_convoys()), 'pendente não vê');
select t.throws(format($$ select public.join_convoy(%L) $$, :'cv'), 'forbidden');
select t.login(:'fora');
select t.throws(format($$ select public.convoy_state(%L) $$, :'cv'), 'forbidden');
select t.throws(format($$ select public.join_convoy(%L) $$, :'cv'), 'forbidden');

select t.login(:'dono');
-- fora do comboio: vê quem está, mas não as posições
select t.ok((select (s->'members'->0->>'lat') is null and not (s->>'joined')::boolean
               from (select public.convoy_state(:'cv') s) x), 'fora do comboio não vê posição');
select public.join_convoy(:'cv');
select t.ok((select (s->'members'->0->>'lat')::float = -23.46 from (select public.convoy_state(:'cv') s) x), 'dentro vê a posição');

select t.login(:'memb');
select public.join_convoy(:'cv');
select t.ok((select jsonb_array_length(s->'members') = 3 from (select public.convoy_state(:'cv') s) x), '3 no comboio');
select t.login(:'dono');
select t.ok((select (m->>'lat') is null from (select jsonb_array_elements(public.convoy_state(:'cv')->'members') m) x
              where m->>'username' = 'memb.c'), 'zona privada esconde');
-- bloqueio esconde
select t.login(:'memb');
select public.block_user('stf.c');
select t.ok((select count(*) = 0 from (select jsonb_array_elements(public.convoy_state(:'cv')->'members') m) x
              where m->>'username' = 'stf.c'), 'bloqueado some do comboio');
select public.unblock_user('stf.c');
-- sai
select public.leave_convoy(:'cv');
select t.ok((select members = 2 and not joined from public.my_convoys() where id = :'cv'), 'saiu');
-- encerrar: membro não; quem criou sim
select t.throws(format($$ select public.end_convoy(%L) $$, :'cv'), 'forbidden');
select t.login(:'stf');
select public.end_convoy(:'cv');
select t.ok((select count(*) = 0 from public.my_convoys()), 'encerrado some da lista');
select t.throws(format($$ select public.join_convoy(%L) $$, :'cv'), 'convoy_ended');
-- não grava direto
select t.throws(format($$ insert into public.convoys (crew_id, created_by, title, dest_lat, dest_lon) values (%L, %L, 'x', 0, 0) $$, :'cc', :'stf'), 'permission denied');

-- ---------- painel de números ----------
select t.login(:'memb');
select public.mark_seen();
select t.throws('select public.master_stats()', 'forbidden');
select t.login(:'mst');
select t.ok((select (s->'people'->>'total')::int >= 6 and (s->'people'->>'active_7d')::int >= 1
                    and jsonb_array_length(s->'signups_14d') = 14 and (s->'social'->>'convoys_7d')::int >= 1
               from (select public.master_stats() s) x), 'painel com números');
select t.ok((select (public.master_stats()->'top_crews'->0->>'name') = 'Equipe C'), 'equipe mais ativa no topo');

-- ---------- Web Push ----------
select t.login(:'memb');
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/abc', repeat('B', 87), repeat('a', 22), 'teste');
select t.ok((select count(*) = 1 from public.push_subscriptions), 'inscrição salva e visível pra pessoa');
select t.login(:'dono');
select t.ok((select count(*) = 0 from public.push_subscriptions), 'não vê a inscrição dos outros');
select t.throws($$ select * from public.take_push_batch(10) $$, 'permission denied');
reset role;
select t.ok((select count(*) >= 1 from public.take_push_batch(50) where endpoint like 'https://fcm%'), 'lote pega a notificação do comboio');
select t.ok((select count(*) = 0 from public.take_push_batch(50)), 'não manda duas vezes');
select public.push_result((select id from public.push_subscriptions limit 1), false, true);
select t.ok((select count(*) = 0 from public.push_subscriptions), 'aparelho que saiu é apagado');

-- ---------- prévia do convite ----------
insert into public.invites (code, created_by, kind) values ('AAAA-1111', :'dono', 'app'), ('BBBB-2222', :'mst', 'founder');
select t.ok((select status = 'ok' and inviter = 'dono.c' and crew_name = 'Equipe C' from public.invite_preview('aaaa-1111')), 'prévia mostra quem convidou e a equipe');
select t.ok((select status = 'ok' and kind = 'fundador' and inviter is null from public.invite_preview('BBBB-2222')), 'fundador não mostra o master');
select t.ok((select status = 'nao_existe' from public.invite_preview('xx')), 'código inválido');

rollback;

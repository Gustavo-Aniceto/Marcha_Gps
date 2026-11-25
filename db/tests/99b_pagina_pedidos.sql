-- Página da equipe (capa, foto, bio), lista de equipes e pedido pra entrar
begin;

select t.crew('Equipe P') as cp \gset
\set dono  'user_2donoP000000000000000p'
\set adm   'user_2admP0000000000000000p'
\set memb  'user_2membP000000000000000p'
\set novo  'user_2novoP000000000000000p'
select t.user(:'dono', 'dono.p', :'cp', 'verified', 'founder');
select t.user(:'adm', 'adm.p', :'cp', 'verified', 'admin');
select t.user(:'memb', 'memb.p', :'cp', 'verified');
select t.user(:'novo', 'novo.p');

set local role authenticated;

-- ---------- página ----------
select t.login(:'dono');
select public.set_crew_page(:'cp', '  Desde 2015 no rebaixado  ', '@equipe.p',
                            'post/' || :'dono' || '/11111111-1111-1111-1111-111111111111.jpg',
                            'post/' || :'dono' || '/22222222-2222-2222-2222-222222222222.jpg');
select t.ok((select bio = 'Desde 2015 no rebaixado' and instagram = 'equipe.p' from public.crews where id = :'cp'), 'bio e instagram salvos');
select t.ok((select (public.crew_page(:'cp'))->>'cover_key' like 'post/%2222.jpg'), 'página traz a capa');
-- foto de outra pessoa não
select t.throws(format($$ select public.set_crew_page(%L, null, null, %L, null) $$, :'cp',
                       'post/' || :'memb' || '/33333333-3333-3333-3333-333333333333.jpg'), 'invalid_photo');
select t.throws(format($$ select public.set_crew_page(%L, %L, null, null, null) $$, :'cp', repeat('x', 601)), 'bio_too_long');
select t.throws(format($$ select public.set_crew_page(%L, null, 'nome com espaço', null, null) $$, :'cp'), 'invalid_instagram');

-- admin edita e mantém a foto que o fundador subiu
select t.login(:'adm');
select public.set_crew_page(:'cp', 'Bio nova', null,
                            (select avatar_key from public.crews where id = :'cp'),
                            (select cover_key from public.crews where id = :'cp'));
select t.ok((select bio = 'Bio nova' and avatar_key like 'post/' || :'dono' || '/%' from public.crews where id = :'cp'), 'admin edita, foto do fundador fica');

-- membro comum não edita
select t.login(:'memb');
select t.throws(format($$ select public.set_crew_page(%L, 'hack', null, null, null) $$, :'cp'), 'forbidden');
select t.throws(format($$ update public.crews set bio = 'hack' where id = %L $$, :'cp'), 'permission denied');

-- ---------- lista de equipes e pedido ----------
select t.login(:'novo');
select t.ok((select not i_am_member and my_request is null from public.crew_directory() where id = :'cp'), 'aparece na lista, sem pedido');
select public.request_join_crew(:'cp', 'oi') as jr \gset
select t.ok((select my_request = 'pending' from public.crew_directory() where id = :'cp'), 'lista mostra pedido enviado');
select t.throws(format($$ select public.request_join_crew(%L, %L) $$, :'cp', repeat('x', 301)), 'already_requested');
-- cancela e pede de novo
select public.cancel_join_request(:'cp');
select t.ok((select my_request = 'cancelled' from public.crew_directory() where id = :'cp'), 'cancelou');
select public.request_join_crew(:'cp') as jr2 \gset
-- não dá pra gravar direto na tabela
select t.throws(format($$ insert into public.crew_join_requests (crew_id, user_id) values (%L, %L) $$, :'cp', :'novo'), 'permission denied');

-- admin (não só o fundador) decide; membro comum não vê nem decide
select t.login(:'memb');
select t.ok((select count(*) from public.crew_join_requests) = 0, 'membro comum não vê pedidos');
select t.throws(format($$ select public.decide_join_request(%L, 'approved') $$, :'jr2'), 'forbidden');
select t.login(:'adm');
select t.ok((select jsonb_array_length((public.crew_page(:'cp'))->'join_requests') = 1), 'admin vê o pedido na página');
select public.decide_join_request(:'jr2', 'rejected');

-- recusado: espera 7 dias
select t.login(:'novo');
select t.throws(format($$ select public.request_join_crew(%L) $$, :'cp'), 'recently_rejected');
select t.ok(not public.is_crew_member(:'cp'), 'recusado não entra');

-- equipe suspensa não recebe pedido
reset role;
update public.crews set status = 'suspended' where id = :'cp';
set local role authenticated;
select t.login(:'novo');
select t.throws(format($$ select public.request_join_crew(%L) $$, :'cp'), 'crew_not_active');

-- convite comum: precisa estar verificado em alguma equipe
reset role;
update public.crews set status = 'active' where id = :'cp';
update public.profiles set invites_left = 2 where id in (:'memb', :'novo');
set local role authenticated;
select t.login(:'novo');
select t.throws($$ select public.create_invite('app') $$, 'forbidden');
select t.login(:'memb');
select public.create_invite('app') as code_app \gset
select t.ok((select kind = 'app' and expires_at < now() + interval '8 days' from public.invites where code = :'code_app'), 'convite de app vence em 7 dias');
select t.throws($$ select public.create_invite('founder') $$, 'forbidden');
select t.throws($$ select public.create_invite('outro') $$, 'invalid_kind');
reset role;
set local role anonymous;
select kind as k from public.check_invite(:'code_app') \gset
reset role;
select t.ok(:'k' = 'app', 'conferência diz que é convite do app');

rollback;

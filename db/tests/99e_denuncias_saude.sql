-- Bloquear, denunciar, fila do Adm Master; erros do app e saúde dos serviços
begin;

select t.crew('Equipe B', 'guarulhos') as cb \gset
\set mst  'user_2mstB000000000000000bb'
\set ana  'user_2anaB000000000000000bb'
\set beto 'user_2betoB00000000000000bb'
\set caio 'user_2caioB00000000000000bb'
\set dani 'user_2daniB00000000000000bb'
select t.user(:'mst', 'master.b');
update public.profiles set is_master = true where id = :'mst';
select t.user(:'ana', 'ana.b', :'cb');
select t.user(:'beto', 'beto.b', :'cb');
select t.user(:'caio', 'caio.b', :'cb');
select t.user(:'dani', 'dani.b', :'cb');
update public.profiles set visibility = 'crew' where id in (:'ana', :'beto');

set local role authenticated;

-- ---------- cenário: posts, comentário e posições ----------
select t.login(:'beto');
insert into public.posts (author_id, body) values (public.current_uid(), 'post do beto') returning id as pb \gset
select public.update_my_location(-23.4600, -46.5300, 0, :'cb');
select t.login(:'ana');
insert into public.posts (author_id, body) values (public.current_uid(), 'post da ana') returning id as pa \gset
insert into public.post_comments (post_id, author_id, body) values (:'pb', public.current_uid(), 'comentário da ana') returning id as ca \gset
select public.update_my_location(-23.4610, -46.5310, 0, :'cb');

select t.ok((select count(*) from public.feed() where id = :'pb') = 1, 'ana vê o post do beto antes de bloquear');
select t.ok((select count(*) from public.visible_cars() where username = 'beto.b') = 1, 'ana vê o carro do beto antes');

-- ---------- bloquear ----------
select public.block_user('beto.b');
select public.block_user('BETO.B ');  -- repetir não dá erro
select t.throws($$ select public.block_user('ana.b') $$, 'cannot_block_self');
select t.throws($$ select public.block_user('ninguem.aqui') $$, 'user_not_found');
select t.ok((select count(*) from public.my_blocks()) = 1, 'lista de bloqueados');
select t.ok((select blocked_by_me from public.block_status('beto.b')), 'status: eu bloqueei');
select t.ok((select count(*) from public.feed() where id = :'pb') = 0, 'ana não vê mais o post do beto');
select t.ok((select count(*) from public.visible_cars() where username = 'beto.b') = 0, 'nem o carro dele no mapa');
select t.ok((select count(*) from public.feed() where id = :'pa') = 1, 'o próprio post continua');

select t.login(:'beto');
select t.ok((select count(*) from public.feed() where id = :'pa') = 0, 'beto também não vê o post da ana (vale pros dois lados)');
select t.ok((select count(*) from public.post_comments_of(:'pb')) = 0, 'beto não vê o comentário da ana no post dele');
select t.ok((select count(*) from public.visible_cars() where username = 'ana.b') = 0, 'nem o carro da ana');
select t.ok((select blocked_me from public.block_status('ana.b')), 'status: ela me bloqueou');
select t.ok((select count(*) from public.user_blocks) = 0, 'beto não lê a lista de bloqueio da ana');
select t.throws(format($$ insert into public.post_comments (post_id, author_id, body) values (%L, public.current_uid(), 'oi') $$, :'pa'),
                'row-level security');

select t.login(:'caio');
select t.ok((select count(*) from public.feed() where id in (:'pa', :'pb')) = 2, 'quem não está no bloqueio vê os dois');

select t.login(:'ana');
select public.unblock_user('beto.b');
select t.ok((select count(*) from public.feed() where id = :'pb') = 1, 'desbloqueou: volta a ver');

-- ---------- denunciar ----------
select t.login(:'beto');
select t.throws(format($$ select public.report_content('post', %L, 'spam') $$, :'pb'), 'own_content');
select t.throws(format($$ select public.report_content('post', %L, 'xingamento') $$, :'pa'), 'invalid_reason');
select t.throws($$ select public.report_content('post', 'nao-e-id', 'spam') $$, 'not_found');
select t.throws($$ select public.report_content('post', '00000000-0000-0000-0000-000000000000', 'spam') $$, 'not_found');
select t.ok(not (public.report_content('post', :'pa', 'ofensivo', 'xingou geral') ->> 'hidden')::boolean, '1ª denúncia não esconde');
select public.report_content('post', :'pa', 'ofensivo');  -- repetida não conta de novo
select t.login(:'caio');
select t.ok(not (public.report_content('post', :'pa', 'spam') ->> 'hidden')::boolean, '2ª denúncia não esconde');
select t.login(:'dani');
select t.ok((public.report_content('post', :'pa', 'ofensivo') ->> 'hidden')::boolean, '3 pessoas: esconde');
select t.ok((select count(*) from public.feed() where id = :'pa') = 0, 'escondido some do feed');
select t.ok((select count(*) from public.content_reports) = 1, 'cada um só vê a própria denúncia');
select public.report_content('profile', 'ANA.B', 'privacidade');
select public.report_content('comment', :'ca', 'ofensivo');

select t.login(:'ana');
select t.ok((select count(*) from public.feed() where id = :'pa') = 1, 'a autora ainda vê o post dela');

select t.login(:'caio');
select t.throws($$ select * from public.master_reports() $$, 'forbidden');
select t.throws(format($$ select public.resolve_report('post', %L, 'remover') $$, :'pa'), 'forbidden');

-- ---------- fila do master ----------
select t.login(:'mst');
select t.ok((select count(*) from public.my_notifications() where kind = 'denuncia') = 3, 'master avisado uma vez por coisa denunciada');
select t.ok((select reports = 3 and hidden and preview = 'post da ana' and owner_username = 'ana.b'
               from public.master_reports() where target_type = 'post'), 'fila: post com 3 denúncias, escondido');
select t.ok((select 'ofensivo' = any (reasons) and 'xingou geral' = any (notes) from public.master_reports() where target_type = 'post'),
            'motivos e recados');
select t.ok((select link = '/perfil/ana.b' from public.master_reports() where target_type = 'profile'), 'link do perfil');
select t.ok((select count(*) from public.feed() where id = :'pa') = 1, 'master vê o escondido');

select public.resolve_report('post', :'pa', 'manter');
select t.login(:'caio');
select t.ok((select count(*) from public.feed() where id = :'pa') = 1, 'mantido: volta a aparecer');

select t.login(:'mst');
select public.resolve_report('comment', :'ca', 'remover');
select t.ok((select count(*) from public.post_comments where id = :'ca') = 0, 'comentário removido');
select public.resolve_report('profile', 'ana.b', 'remover');
select t.throws(format($$ select public.resolve_report('post', %L, 'manter') $$, :'pa'), 'request_not_found');
select t.ok((select count(*) from public.master_reports()) = 0, 'fila vazia');
select t.ok((select count(*) from public.master_reports('removed')) = 2, 'histórico dos removidos');

select t.login(:'ana');
select t.ok((select count(*) from public.my_notifications() where kind = 'moderacao') = 2, 'autora avisada do que saiu');

-- ---------- erros do app e saúde ----------
select t.throws($$ select public.log_app_error('x', null, null, null, null, null) $$, 'permission denied');
reset role;
select public.log_app_error('TypeError: cannot read 123', 'at x', '/post/aaaaaaaa-1111', 'Chrome', 'v1', :'ana');
select public.log_app_error('TypeError: cannot read 456', 'at x', '/post/bbbbbbbb-2222', 'Chrome', 'v1', :'beto');
select public.log_app_error('TypeError: cannot read 789', null, '/post/bbbbbbbb-2222', 'Chrome', 'v1', :'beto');
select public.log_app_error('   ', null, null, null, null, null);  -- vazio é ignorado
select t.ok((select count(*) from public.app_errors) = 1 and (select hits from public.app_errors) = 3, 'repetidos viram uma linha');
select t.ok((select cardinality(users) from public.app_errors) = 2, 'conta as pessoas afetadas');
select public.log_app_error('outro erro', null, null, null, null, 'user_que_nao_existe');
select t.ok((select user_id is null from public.app_errors where message = 'outro erro'), 'usuário desconhecido não quebra');

select public.record_health('photon', true, null, 120);
select public.record_health('login_producao', false, 'sem DNS', null);   -- 1ª vez: só registra
select public.record_health('photon', false, 'HTTP 503', 900);
select public.record_health('photon', false, 'HTTP 503', 900);           -- continua fora: não repete
select public.record_health('photon', true, null, 300);
select t.throws($$ select public.record_health('Nome Ruim!', true) $$, 'invalid_service');

set local role authenticated;
select t.login(:'mst');
select t.ok((select count(*) from public.my_notifications() where kind = 'saude') = 2, 'master: caiu (1x) e voltou; a 1ª checagem não avisa');
select t.ok((public.master_health() -> 'errors_24h')::int = 4, 'painel conta os erros');
select t.ok(jsonb_array_length(public.master_health() -> 'services') = 2, 'painel mostra os serviços');
select t.throws($$ select count(*) from public.app_errors $$, 'permission denied');
select t.login(:'caio');
select t.throws($$ select public.master_health() $$, 'forbidden');

rollback;

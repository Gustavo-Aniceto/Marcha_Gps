-- Conta (perfil, notificações, exportar/apagar), painel de eventos, descobrir equipes, ficha FIPE
begin;

select t.crew('Equipe N', 'guarulhos') as cn \gset
\set mst   'user_2mstN000000000000000nn'
\set dono  'user_2donoN00000000000000nn'
\set memb  'user_2membN00000000000000nn'
\set novo  'user_2novoN00000000000000nn'
\set sai   'user_2saiN000000000000000nn'
select t.user(:'mst', 'master.n');
update public.profiles set is_master = true where id = :'mst';
select t.user(:'dono', 'dono.n', :'cn', 'verified', 'founder');
select t.user(:'memb', 'memb.n', :'cn', 'verified');
select t.user(:'novo', 'novo.n');
select t.user(:'sai', 'sai.n');

set local role authenticated;

-- ---------- editar perfil ----------
select t.login(:'novo');
select public.set_my_profile('  Novo da Silva ', 'Gol quadrado rebaixado');
select t.ok((select display_name = 'Novo da Silva' and bio = 'Gol quadrado rebaixado' from public.my_profile()), 'nome e bio salvos');
select t.ok((select display_name = 'Novo da Silva' from public.public_profile('novo.n')), 'aparecem no perfil público');
select t.throws($$ select public.set_my_profile(repeat('x', 41), null) $$, 'name_too_long');
select t.throws(format($$ update public.profiles set bio = 'hack' where id = %L $$, :'novo'), 'permission denied');

-- ---------- notificações ----------
-- pedido de equipe nova -> master é avisado
reset role;
insert into public.invites (code, kind, created_by, used_by, used_at, expires_at)
values ('AAAA-0001', 'founder', :'mst', :'sai', now(), 'infinity');
set local role authenticated;
select t.login(:'sai');
insert into public.crew_requests (requester_id, name, city_id, member_count) values (:'sai', 'Equipe Saida', 'guarulhos', 6);
select t.login(:'mst');
select t.ok((select count(*) from public.my_notifications() where kind = 'equipe_pedida' and title like '%Equipe Saida%') = 1,
            'master recebe aviso de equipe pedida');
select t.ok(public.unread_notifications() >= 1, 'conta como não lida');
-- aprova -> quem pediu é avisado
select public.review_crew_request((select id from public.crew_requests where name = 'Equipe Saida'), 'approved') as crew_saida \gset
select t.login(:'sai');
select t.ok((select count(*) from public.my_notifications() where kind = 'equipe_decidida' and link = '/equipe/' || :'crew_saida') = 1,
            'quem pediu é avisado da aprovação');
-- cada um só vê os próprios
select t.ok((select count(*) from public.notifications) = (select count(*) from public.my_notifications()), 'só vê as próprias');
select t.throws($$ insert into public.notifications (user_id, kind, topic, title) values (auth.user_id(), 'x', 'social', 'x') $$, 'permission denied');
select t.throws($$ select public.notify(auth.user_id(), 'x', 'social', 'x') $$, 'permission denied');

-- pedido pra entrar -> fundador; decisão -> quem pediu
select t.login(:'novo');
select public.request_join_crew(:'cn', 'oi') as jr \gset
select t.login(:'dono');
select t.ok((select count(*) from public.my_notifications() where kind = 'pedido_entrar') = 1, 'fundador avisado do pedido');
select public.decide_join_request(:'jr', 'approved');
select t.login(:'novo');
select t.ok((select count(*) from public.my_notifications() where kind = 'entrada_decidida' and title like 'Você entrou%') = 1,
            'novo avisado da aprovação');
-- marcar como lida
select public.mark_notifications_read();
select t.ok(public.unread_notifications() = 0, 'tudo lido');

-- preferência: sem avisos de eventos
select public.set_notify_prefs(true, false, true);
select t.login(:'dono');
insert into public.events (crew_id, kind, title, starts_at, ends_at, lat, lon, visibility, created_by, description, place_name)
values (:'cn', 'encontro', 'Encontro N', now() + interval '1 day', now() + interval '1 day 3 hours', -23.46, -46.53, 'open', :'dono',
        'Rolê de teste', 'Posto X')
returning id as ev \gset
select t.login(:'memb');
select t.ok((select count(*) from public.my_notifications() where kind = 'evento') = 1, 'membro avisado do evento');
select t.login(:'novo');
select t.ok((select count(*) from public.my_notifications() where kind = 'evento') = 0, 'quem desligou eventos não recebe');

-- comentário no post
select t.login(:'memb');
insert into public.posts (author_id, kind, body) values (:'memb', 'post', 'meu post') returning id as post \gset
select t.login(:'novo');
insert into public.post_comments (post_id, author_id, body) values (:'post', :'novo', 'show!');
select t.login(:'memb');
select t.ok((select count(*) from public.my_notifications() where kind = 'comentario' and link = '/post/' || :'post') = 1, 'dono do post avisado');

-- ---------- painel de eventos ----------
select t.login(:'sai'); -- não é da Equipe N
select t.ok((select count(*) from public.events_board() where id = :'ev') = 1, 'evento aberto aparece pra quem é de fora');
select t.ok((select not i_am_member and description = 'Rolê de teste' and place_name = 'Posto X' and city = 'Guarulhos'
               from public.events_board() where id = :'ev'), 'com descrição, local e cidade');
select t.ok(public.set_rsvp(:'ev', true) = 1, 'confirma presença');
select t.ok((select i_am_going and going = 1 from public.events_board() where id = :'ev'), 'aparece como vou');
select t.ok((select count(*) from public.events_board('vou')) = 1, 'filtro vou');
select t.ok((select count(*) from public.events_board('minhas')) = 0, 'filtro minhas equipes');
select t.ok(public.set_rsvp(:'ev', false) = 0, 'desconfirma');
-- evento só da equipe não aparece pra quem é de fora
select t.login(:'dono');
insert into public.events (crew_id, kind, title, starts_at, ends_at, lat, lon, visibility, created_by)
values (:'cn', 'encontro', 'Fechado N', now() + interval '2 day', now() + interval '2 day 3 hours', -23.46, -46.53, 'crew', :'dono')
returning id as ev2 \gset
-- capa de outra pessoa não
select t.throws(format($$ update public.events set cover_key = %L where id = %L $$,
                       'post/' || :'memb' || '/44444444-4444-4444-4444-444444444444.jpg', :'ev2'), 'invalid_photo');
update public.events set cover_key = 'post/' || :'dono' || '/55555555-5555-5555-5555-555555555555.jpg' where id = :'ev2';
select t.login(:'sai');
select t.ok((select count(*) from public.events_board() where id = :'ev2') = 0, 'evento fechado não aparece pra quem é de fora');
select t.throws(format($$ select public.set_rsvp(%L, true) $$, :'ev2'), 'event_not_found');
select t.login(:'memb');
select t.ok((select cover_key like '%5555.jpg' from public.events_board() where id = :'ev2'), 'membro vê o fechado, com capa');

-- ---------- descobrir equipes ----------
select t.login(:'sai');
select t.ok((select founder = 'dono.n' and member_count >= 2 and next_event is not null and not i_am_member
               from public.crew_directory() where id = :'cn'), 'lista mostra fundador, membros e próximo evento');

-- ---------- ficha FIPE ----------
select t.login(:'memb');
insert into public.cars (owner_id, make, model) values (:'memb', 'Chevrolet', 'Astra');
update public.cars set fipe_code = '004072-0', fipe_brand = 'GM - Chevrolet', fipe_model = 'Astra', fipe_version = 'GLS 2.0 MPFI',
       fipe_year = 1995, fipe_fuel = 'Gasolina', fipe_price = 'R$ 12.479,00', fipe_ref = 'novembro de 2026'
 where owner_id = :'memb';
select t.throws(format($$ update public.cars set fipe_code = 'abc' where owner_id = %L $$, :'memb'), 'check');

-- ---------- exportar e apagar ----------
select t.login(:'novo');
select t.ok((select (d -> 'perfil' ->> 'username') = 'novo.n' and jsonb_array_length(d -> 'comentarios') = 1
                    and not (d -> 'perfil' ? 'is_master')
               from public.my_data_export() d), 'exporta os próprios dados');
select t.throws($$ select public.delete_my_account('outro.nome') $$, 'confirm_mismatch');
-- fundador com membros não apaga
select t.login(:'dono');
select t.throws($$ select public.delete_my_account('dono.n') $$, 'founder_with_members');
-- membro que criou evento: o evento fica com o fundador
reset role;
update public.crew_members set role = 'admin' where user_id = :'memb' and crew_id = :'cn';
set local role authenticated;
select t.login(:'memb');
insert into public.events (crew_id, kind, title, starts_at, ends_at, lat, lon, visibility, created_by)
values (:'cn', 'encontro', 'Do membro', now() + interval '3 day', now() + interval '3 day 2 hours', -23.46, -46.53, 'crew', :'memb')
returning id as ev3 \gset
select public.delete_my_account(' MEMB.N ');
reset role;
select t.ok(not exists (select 1 from public.profiles where id = :'memb'), 'perfil apagado');
select t.ok((select created_by from public.events where id = :'ev3') = :'dono', 'evento passou pro fundador');
select t.ok(not exists (select 1 from public.posts where author_id = :'memb'), 'posts saem junto');
set local role authenticated;

rollback;

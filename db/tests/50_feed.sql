-- Feed, curtidas, presença e mídia com foto própria
begin;
\set a 'user_feedA00000000000000000a'
\set b 'user_feedB00000000000000000b'
\set o 'user_feedO00000000000000000o'
\set p 'user_feedP00000000000000000p'
select t.crew('Low Família', 'guarulhos') as x \gset
select t.crew('Bonde ABC') as y \gset
select t.user(:'a', 'admin.a', :'x', 'verified', 'founder');
select t.user(:'b', 'membro.b', :'x');
select t.user(:'o', 'outro.o', :'y');
select t.user(:'p', 'pendente.p', :'x', 'pending');

set local role authenticated;

-- post na equipe e no geral
select t.login(:'a');
insert into public.posts (author_id, crew_id, body) values (auth.user_id(), :'x', 'Sábado tem rolê') returning id as px \gset
insert into public.posts (author_id, body) values (auth.user_id(), 'Alguém sabe se 17x7 entra no Gol?') returning id as pg \gset
select t.throws(format($$ insert into public.posts (author_id, crew_id, body) values (%L, %L, 'oi') $$, :'a', :'y'), 'row-level security');
select t.throws(format($$ insert into public.posts (author_id, body) values (%L, 'me passando por outro') $$, :'b'), 'row-level security');
select t.throws($$ insert into public.posts (author_id, body) values (auth.user_id(), '   ') $$, 'check constraint');
-- foto: só a própria
select t.throws(format($$ insert into public.posts (author_id, body, photo_key)
                          values (auth.user_id(), 'foto', 'media/%s/0b6a1c1e-1111-4a4a-9c9c-123456789abc.jpg') $$, :'b'), 'row-level security');
insert into public.posts (author_id, body, photo_key)
values (auth.user_id(), 'meu carro', format('media/%s/0b6a1c1e-1111-4a4a-9c9c-123456789abc.jpg', :'a'));

-- quem é de fora vê o geral, não a equipe
select t.login(:'o');
select t.ok((select count(*) from public.feed(null)) = 2, 'outra equipe vê o geral');
select t.ok((select count(*) from public.feed(:'x')) = 0, 'outra equipe não vê feed da Low Família');
select t.ok((select count(*) from public.posts where crew_id = :'x') = 0, 'nem direto na tabela');
select t.throws(format($$ insert into public.post_likes (post_id, user_id) values (%L, auth.user_id()) $$, :'px'), 'row-level security');

-- pendente vê o feed da equipe e pode postar no geral
select t.login(:'p');
select t.ok((select count(*) from public.feed(:'x')) = 1, 'pendente vê feed da equipe');
insert into public.posts (author_id, body) values (auth.user_id(), 'cheguei agora');

-- curtir
select t.login(:'b');
insert into public.post_likes (post_id, user_id) values (:'px', auth.user_id());
select t.ok((select likes = 1 and liked_by_me from public.feed(:'x') where id = :'px'), 'curtida contada');
select t.throws(format($$ insert into public.post_likes (post_id, user_id) values (%L, auth.user_id()) $$, :'px'), 'duplicate key');

-- apagar: o próprio autor ou admin da equipe
select t.login(:'o');
delete from public.posts where id = :'pg';
select t.login(:'a');
select t.ok(exists (select 1 from public.posts where id = :'pg'), 'outro não apaga post alheio');
select t.login(:'b');
insert into public.posts (author_id, crew_id, body) values (auth.user_id(), :'x', 'post do B') returning id as pb \gset
select t.login(:'a');
delete from public.posts where id = :'pb';
select t.ok(not exists (select 1 from public.posts where id = :'pb'), 'admin apaga post da equipe');

-- evento + presença
insert into public.events (crew_id, kind, title, starts_at, ends_at, lat, lon, radius_m, created_by)
values (:'x', 'encontro', 'Encontro de terça', now() - interval '5 minutes', now() + interval '2 hours', -23.46, -46.53, 200, auth.user_id())
returning id as ev \gset
select t.login(:'b');
insert into public.event_rsvps (event_id, user_id) values (:'ev', auth.user_id());
select t.ok((select going = 1 and i_am_going from public.upcoming_events() where id = :'ev'), 'presença contada');
select t.login(:'o');
select t.ok((select count(*) from public.upcoming_events()) = 0, 'evento fechado não aparece pra fora');
select t.throws(format($$ insert into public.event_rsvps (event_id, user_id) values (%L, auth.user_id()) $$, :'ev'), 'row-level security');

-- mídia: só com foto própria e pela função nova
select t.login(:'b');
select t.throws(format($$ select public.submit_event_media(%L, 'x', -23.46, -46.53) $$, :'ev'), 'permission denied');
select t.throws(format($$ select public.submit_event_media_checked(%L, 'media/%s/0b6a1c1e-1111-4a4a-9c9c-123456789abc.jpg', -23.46, -46.53) $$, :'ev', :'a'),
                'invalid_photo');
select public.submit_event_media_checked(:'ev', format('media/%s/9f1d2c3b-2222-4b4b-8d8d-abcdefabcdef.jpg', :'b'), -23.4601, -46.5301);
select t.ok((select my_media from public.upcoming_events() where id = :'ev'), 'mídia registrada');
select t.ok((select xp from public.crew_members where crew_id = :'x' and user_id = auth.user_id()) = 50, '+50 XP');

rollback;

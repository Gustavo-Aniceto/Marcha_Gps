-- Feed social: comentários, foto de perfil, perfil público, filtro por autor, carro
begin;
\set a 'user_socA000000000000000000a'
\set b 'user_socB000000000000000000b'
insert into public.profiles (id, username) values (:'a', 'ana.baixa'), (:'b', 'beto.fixa');

set local role authenticated;
select t.login(:'a');
insert into public.cars (owner_id, make, model, ride_height_cm, suspension) values (public.current_uid(), 'VW', 'Gol G5', 8, 'ar');
insert into public.posts (author_id, body) values (public.current_uid(), 'Primeiro rolê') returning id as p1 \gset
select public.set_my_avatar('post/' || public.current_uid() || '/123e4567-e89b-12d3-a456-426614174000.jpg');
select t.throws($$ select public.set_my_avatar('post/user_outro/123e4567-e89b-12d3-a456-426614174000.jpg') $$, 'invalid_photo');
select t.ok((select avatar_key is not null from public.my_profile()), 'foto de perfil salva');

select t.login(:'b');
insert into public.post_comments (post_id, author_id, body) values (:'p1', public.current_uid(), 'Brabo!') returning id as c1 \gset
select t.throws(format($$ insert into public.post_comments (post_id, author_id, body) values (%L, %L, 'fingindo') $$, :'p1', :'a'), 'row-level security');
select t.ok((select comments = 1 and author_car = 'VW Gol G5' and not mine and avatar_key is not null from public.feed() where id = :'p1'), 'feed traz comentários, carro e foto do autor');
select t.ok((select count(*) from public.post_comments_of(:'p1')) = 1, 'lista comentários');
select t.ok((select username from public.post_comments_of(:'p1')) = 'beto.fixa', 'comentário com autor');
select t.ok((select count(*) from public.feed(null, null, 30, :'a')) = 1, 'posts do perfil');
select t.ok((select car->>'model' from public.public_profile('Ana.Baixa')) = 'Gol G5', 'perfil mostra o carro');
select t.ok((select posts from public.public_profile('ana.baixa')) = 1, 'perfil conta posts públicos');

-- dono do post apaga comentário dos outros; outro não apaga
select t.login(:'a');
delete from public.post_comments where id = :'c1';
select t.ok((select count(*) from public.post_comments_of(:'p1')) = 0, 'dono do post apaga comentário');
select t.ok((select mine from public.feed() where id = :'p1'), 'post marcado como meu');
reset role;
rollback;

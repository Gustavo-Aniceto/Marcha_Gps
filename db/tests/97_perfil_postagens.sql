-- Perfil: post, foto do carro e enquete; Adm Master vê a Cena ao vivo.
begin;
select t.crew('Equipe Mural') as crew \gset
select t.user('user_murA00000000000000000a', 'mural.a') as a \gset
select t.user('user_murB00000000000000000b', 'mural.b') as b \gset
select t.user('user_murM00000000000000000m', 'mural.master') as m \gset
select t.user('user_murV00000000000000000v', 'mural.visivel', :'crew') as v \gset
select t.user('user_murW00000000000000000w', 'mural.ve', :'crew') as w \gset
update public.profiles set is_master = true where id = :'m';
update public.profiles set visibility = 'scene' where id = :'v';

set local role authenticated;
select t.login(:'a');
-- foto do carro precisa de foto
select t.throws(format($$ insert into public.posts (author_id, body, kind) values (%L, 'meu carro', 'carro') $$, :'a'), 'posts_carro_tem_foto');
insert into public.posts (author_id, body, kind, photo_key)
  values (:'a', 'Gol na fixa', 'carro', 'post/' || :'a' || '/123e4567-e89b-12d3-a456-426614174000.jpg');
-- enquete não entra pelo insert direto (sem opções)
select t.throws(format($$ insert into public.posts (author_id, body, kind) values (%L, 'qual aro?', 'enquete') $$, :'a'), 'row-level security');
select t.throws($$ select public.create_poll('Só uma opção?', array['sim']) $$, 'invalid_poll');
select t.throws($$ select public.create_poll('Muitas?', array['1','2','3','4','5']) $$, 'invalid_poll');
select public.create_poll('Qual aro fica melhor?', array['15', '17', ' ', '18']) as poll \gset
select t.ok((select jsonb_array_length(poll->'options') = 3 and (poll->>'total')::int = 0 and poll->'my_vote' = 'null'::jsonb
               from public.feed(null, null, 30, :'a', 'enquete') where id = :'poll'), 'enquete com 3 opções (vazia some)');

select t.login(:'b');
select t.ok((public.vote_poll(:'poll', 1)->>'total')::int = 1, 'votou');
select t.ok((public.vote_poll(:'poll', 2)->>'my_vote')::int = 2, 'trocou o voto');
select t.ok((select (poll->>'total')::int = 1 from public.feed() where id = :'poll'), 'troca não duplica voto');
select t.throws(format($$ select public.vote_poll(%L, 7) $$, :'poll'), 'invalid_poll');
select t.throws($$ select * from public.poll_votes $$, 'permission denied');
select t.ok((select count(*) from public.feed(null, null, 30, :'a', 'carro')) = 1, 'aba fotos do carro');
select t.ok((select count(*) from public.feed(null, null, 30, :'a')) = 2, 'perfil mostra tudo');
select t.ok((select kind from public.feed(null, null, 30, :'a', 'carro')) = 'carro', 'tipo vem no feed');

-- Cena ao vivo: membro verificado vê; Master sem equipe também vê; quem não é nada não vê
select t.login(:'v'); select public.update_my_location(-23.5501, -46.6301, 90);
select t.login(:'w');
select t.ok((select count(*) from public.visible_cars() where user_id = :'v') = 1, 'verificado vê');
select t.login(:'m');
select t.ok((select count(*) from public.visible_cars() where user_id = :'v') = 1, 'Adm Master vê a cena');
select t.login(:'b');
select t.ok((select count(*) from public.visible_cars()) = 0, 'sem equipe não vê');
reset role;
rollback;

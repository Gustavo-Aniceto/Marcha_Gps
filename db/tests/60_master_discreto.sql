-- Adm Master discreto: só fundadores sabem quem é
begin;

\set master  'user_2master000000000000000a'
\set founder 'user_2founder00000000000000f'
\set membro  'user_2membro00000000000000m'

insert into public.profiles (id, username, is_master) values (:'master', 'adm.master', true);

set local role authenticated;

select t.login(:'master');
select public.create_invite(null) as code_f \gset
select t.ok((select is_master from public.my_profile()), 'master se vê como master');

select t.login(:'founder');
select public.redeem_invite(:'code_f', 'dono.equipe');
-- ainda sem equipe aprovada: não é fundador, não vê o master
select t.ok(not exists (select 1 from public.master_contact()), 'pedido em análise não vê o master');
select t.ok(not (select is_master from public.my_profile()), 'fundador não é master');
insert into public.crew_requests (requester_id, name, city_id, member_count)
  values (auth.user_id(), 'Baixos SP', 'sao_paulo', 10);
select id as req from public.crew_requests \gset
-- quem analisou o pedido não aparece
select t.throws($$ select reviewed_by from public.crew_requests $$, 'permission denied');

select t.login(:'master');
select public.review_crew_request(:'req', 'approved') as crew \gset
select t.ok((select count(*) from public.master_contact()) = 1, 'master vê o próprio contato');

select t.login(:'founder');
select t.ok((select username from public.master_contact()) = 'adm.master', 'fundador vê quem é o master');
select public.create_invite(:'crew') as code_m \gset

select t.login(:'membro');
select public.redeem_invite(:'code_m', 'membro.comum');
select t.ok(not exists (select 1 from public.master_contact()), 'membro não vê o master');
select t.throws($$ select is_master from public.profiles $$, 'permission denied');
select t.throws($$ select invites_left from public.profiles $$, 'permission denied');
select t.ok((select count(*) from public.profiles where username = 'adm.master') = 1, 'o perfil aparece, mas sem marca de master');
select t.ok((select count(*) from public.my_profile()) = 1 and (select id from public.my_profile()) = auth.user_id(),
            'my_profile só devolve o próprio');

-- mesmo virando fundador de outro jeito o membro comum continua sem ver (só founder verificado)
update public.profiles set visibility = 'crew' where id = auth.user_id();
select t.ok((select visibility from public.my_profile()) = 'crew', 'ainda muda a própria visibilidade');

rollback;

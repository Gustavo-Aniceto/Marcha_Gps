-- Convites, pedido de equipe, aprovação do Adm Master e verificação dos membros
begin;

\set master  'user_2master000000000000000a'
\set founder 'user_2founder00000000000000f'
\set a       '00000000-0000-0000-0000-0000000000a1'
\set b       '00000000-0000-0000-0000-0000000000b1'
\set n       '00000000-0000-0000-0000-0000000000c1'
\set out     '00000000-0000-0000-0000-0000000000d1'

-- o primeiro Adm Master é criado na mão (ver README)
insert into public.profiles (id, username, is_master) values (:'master', 'adm.master', true);

set local role authenticated;

-- sem perfil não dá pra fazer nada
select t.login(:'out');
select t.throws($$ select public.create_report('lombada', -23.55, -46.63) $$, 'no_profile');
select t.throws($$ select public.create_invite(null) $$, 'no_profile');

-- Adm Master gera convite de fundador
select t.login(:'master');
select public.create_invite(null) as code_founder \gset
select t.ok(:'code_founder' ~ '^[0-9A-F]{4}-[0-9A-F]{4}$', 'formato do código');

-- o fundador entra
select t.login(:'founder');
select t.ok(public.redeem_invite(:'code_founder', 'Founder.LF') is null, 'convite de fundador não tem equipe');
select t.ok((select username from public.profiles where id = public.current_uid()) = 'founder.lf', 'username em minúsculo');
select t.throws(format($$ select public.redeem_invite(%L, 'x123') $$, :'code_founder'), 'invite_used');
-- membro comum não cria convite de fundador
select t.throws($$ select public.create_invite(null) $$, 'forbidden');

-- pede a equipe
insert into public.crew_requests (requester_id, name, city_id, instagram, member_count, accepts_video_call)
values (public.current_uid(), 'Low Família', 'guarulhos', '@lowfamilia', 14, true);
select id as req from public.crew_requests \gset
-- não dá pra pedir já aprovado
select t.throws($$ insert into public.crew_requests (requester_id, name, city_id, member_count, status)
                   values (public.current_uid(), 'Fake', 'sao_paulo', 3, 'approved') $$, 'row-level security');
-- só o Adm Master aprova
select t.throws(format($$ select public.review_crew_request(%L, 'approved') $$, :'req'), 'forbidden');

select t.login(:'master');
select public.review_crew_request(:'req', 'approved', 'Instagram ok, chamada feita') as crew \gset
select t.throws(format($$ select public.review_crew_request(%L, 'rejected') $$, :'req'), 'already_reviewed');

select t.login(:'founder');
select t.ok(public.is_crew_admin(:'crew'), 'fundador vira admin verificado');
select t.ok((select invites_left from public.my_profile()) = 5, 'fundador ganha 5 convites');

-- convites da equipe
select public.create_invite(:'crew') as code_a \gset
select public.create_invite(:'crew') as code_b \gset
select public.create_invite(:'crew') as code_n \gset
select t.ok((select invites_left from public.my_profile()) = 2, 'convites descontados');
select t.throws(format($$ select public.redeem_invite(%L, 'eu.mesmo') $$, :'code_a'), 'own_invite');

select t.login(:'a');  select public.redeem_invite(:'code_a', 'membro.a');
select t.login(:'b');  select public.redeem_invite(:'code_b', 'membro.b');
select t.login(:'n');  select public.redeem_invite(:'code_n', 'novato.n');
select t.throws(format($$ select public.redeem_invite(%L, 'outro') $$, :'code_n'), 'invite_used');

select t.login(:'a');
select t.ok((select status from public.crew_members where user_id = public.current_uid()) = 'pending', 'entra pendente');
select t.ok(not public.is_verified_anywhere(), 'pendente não é verificado');
-- pendente não confirma ninguém
select t.throws(format($$ select public.vouch_member(%L, %L) $$, :'crew', :'b'), 'forbidden');
-- membro não faz check-in
select t.throws(format($$ select public.admin_checkin(%L, %L) $$, :'crew', :'b'), 'forbidden');
-- não pode mexer nos próprios convites nem virar master
select t.throws($$ update public.profiles set invites_left = 99 where id = public.current_uid() $$, 'permission denied');
select t.throws($$ update public.profiles set is_master = true where id = public.current_uid() $$, 'permission denied');
update public.profiles set visibility = 'scene', delay_minutes = 2 where id = public.current_uid();
select t.ok((select visibility from public.my_profile()) = 'scene', 'muda a própria visibilidade');

-- equipe nova: só o fundador está verificado, então 1 confirmação + check-in bastam
select t.login(:'founder');
select t.ok(public.vouch_member(:'crew', :'a') = 'pending', 'só confirmação não basta');
select t.ok(public.admin_checkin(:'crew', :'a') = 'verified', 'confirmação + check-in verifica');
select t.ok((select xp from public.crew_members where crew_id = :'crew' and user_id = public.current_uid()) = 40,
            'padrinho ganha 40 XP');

-- agora já existem 2 verificados: B precisa de 2 confirmações
select t.ok(public.vouch_member(:'crew', :'b') = 'pending', '1 confirmação');
select t.ok(public.admin_checkin(:'crew', :'b') = 'pending', 'check-in sem a 2ª confirmação');
select t.login(:'a');
select t.ok(public.vouch_member(:'crew', :'b') = 'verified', '2ª confirmação verifica');
select t.throws(format($$ select public.vouch_member(%L, %L) $$, :'crew', :'a'), 'cannot_vouch_self');

-- quem é de fora não confirma
select t.login(:'out');
select t.throws(format($$ select public.vouch_member(%L, %L) $$, :'crew', :'n'), 'no_profile');

-- membros vêem a equipe; convites só quem criou
select t.login(:'n');
select t.ok((select count(*) from public.crew_members where crew_id = :'crew') = 4, 'pendente vê a lista da equipe');
select t.ok((select count(*) from public.invites) = 0, 'não vê convites dos outros');

-- convites acabam
select t.login(:'founder');
select public.create_invite(:'crew'); select public.create_invite(:'crew');
select t.throws(format($$ select public.create_invite(%L) $$, :'crew'), 'no_invites_left');

-- tema: só admin
select public.set_crew_theme(:'crew', '#3fa0ff', 'redondo');
select t.ok((select color from public.crews where id = :'crew') = '#3FA0FF', 'tema salvo');
select t.throws(format($$ select public.set_crew_theme(%L, 'azul', 'reto') $$, :'crew'), 'check constraint');
select t.login(:'a');
select t.throws(format($$ select public.set_crew_theme(%L, '#000000', 'reto') $$, :'crew'), 'forbidden');

-- fundador promove A a admin; A não promove ninguém
select t.login(:'founder');
select public.set_member_role(:'crew', :'a', 'admin');
select t.login(:'a');
select t.ok(public.is_crew_admin(:'crew'), 'A virou admin');
select t.throws(format($$ select public.set_member_role(%L, %L, 'admin') $$, :'crew', :'b'), 'forbidden');

-- visitante (anonymous) não chama nada
reset role;
set local role anonymous;
select t.throws($$ select public.visible_cars() $$, 'permission denied');
select t.throws($$ select * from public.profiles $$, 'permission denied');

rollback;

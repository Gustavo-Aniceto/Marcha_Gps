-- Login no Neon Auth: conta antiga (id do Clerk) é reconectada pelo e-mail verificado
begin;
\set old 'user_2antigo000000000000000x'
\set novo '11111111-2222-4333-8444-555555555555'
\set outro '99999999-2222-4333-8444-555555555555'
-- membro verificado de equipe (com confirmação e check-in): era isso que travava a reconexão
select t.crew('Equipe Legado') as crew \gset
select t.user(:'old', 'antigo.x', :'crew');
select t.user('user_2amigo0000000000000000x', 'amigo.x', :'crew');
insert into public.member_vouches (crew_id, member_id, voucher_id) values (:'crew', :'old', 'user_2amigo0000000000000000x'),
                                                                          (:'crew', 'user_2amigo0000000000000000x', :'old');
insert into public.member_checkins (crew_id, member_id, admin_id) values (:'crew', :'old', 'user_2amigo0000000000000000x');
insert into public.cars (owner_id, make, model, ride_height_cm, suspension) values (:'old', 'VW', 'Gol', 8, 'ar');
insert into public.posts (author_id, body) values (:'old', 'post antigo');
insert into public.legacy_logins (old_id, email) values (:'old', 'Antigo@Exemplo.com');
insert into neon_auth."user" (id, email, "emailVerified") values (:'novo', 'antigo@exemplo.com', true),
                                                              (:'outro', 'antigo2@exemplo.com', false);
insert into neon_auth.session ("userId") values (:'novo');

set local role authenticated;
-- e-mail não verificado ou sem conta antiga: nada
select t.login(:'outro');
select t.ok(public.claim_legacy_account() = 'nada', 'sem conta antiga não acontece nada');
-- mesmo e-mail verificado: reconecta
select t.login(:'novo');
select t.ok(public.claim_legacy_account() = 'recuperada', 'conta antiga reconectada');
select t.ok((select username from public.my_profile()) = 'antigo.x', 'perfil é o mesmo');
select t.ok(public.claim_legacy_account() = 'ja_tem', 'segunda vez não faz nada');
-- foto antiga continua sendo dela
select public.set_my_avatar('post/' || :'old' || '/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg');
select t.throws($$ select public.set_my_avatar('post/user_2outro0000000000000000000/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg') $$, 'invalid_photo');
reset role;
select t.ok((select count(*) = 1 from public.cars where owner_id = :'novo'), 'carro foi junto');
select t.ok((select count(*) = 1 from public.posts where author_id = :'novo'), 'post foi junto');
select t.ok((select count(*) = 0 from public.profiles where id = :'old'), 'id antigo sumiu');
select t.ok((select count(*) = 1 from public.crew_members where user_id = :'novo'), 'continua na equipe');
select t.ok((select count(*) = 2 from public.member_vouches where :'novo' in (member_id, voucher_id)), 'confirmações foram junto');
select t.ok((select count(*) = 1 from public.member_checkins where member_id = :'novo'), 'check-in foi junto');
select t.ok((select new_id = :'novo' from public.legacy_logins where old_id = :'old'), 'reconexão anotada');

-- apagar conta apaga o login também
set local role authenticated;
select t.login(:'novo');
select public.delete_my_account('antigo.x');
reset role;
select t.ok((select count(*) = 0 from neon_auth."user" where id = :'novo'), 'login apagado junto');
select t.ok((select count(*) = 0 from neon_auth.session where "userId" = :'novo'), 'sessões apagadas junto');
rollback;

-- O convite é conferido antes do login (papel anonymous), sem revelar nada além do necessário
begin;

insert into public.profiles (id, username, is_master) values ('user_2master0000000000000000b', 'mestre', true);
set local role authenticated;
select t.login('user_2master0000000000000000b');
select public.create_invite(null) as code \gset
reset role;

set local role anonymous;
select status as s1, kind as k1 from public.check_invite(:'code') \gset
select status as s2 from public.check_invite('0000-0000') \gset
select status as s3 from public.check_invite('x; drop table') \gset
select status as s4 from public.check_invite(lower(:'code')) \gset
reset role;
select t.ok(:'s1' = 'ok' and :'k1' = 'fundador', 'convite válido de fundador');
select t.ok(:'s2' = 'nao_existe', 'código que não existe');
select t.ok(:'s3' = 'nao_existe', 'lixo não quebra');
select t.ok(:'s4' = 'ok', 'aceita minúscula');

set local role anonymous;
select t.throws($$ select * from public.invites $$, 'permission denied');
select t.throws($$ select public.redeem_invite('AAAA-AAAA', 'x') $$, 'permission denied');
reset role;

-- depois de usado
set local role authenticated;
select t.login('user_2novo000000000000000000c');
select public.redeem_invite(:'code', 'novo.membro');
reset role;
set local role anonymous;
select status as s5 from public.check_invite(:'code') \gset
reset role;
select t.ok(:'s5' = 'usado', 'convite usado');

-- a conta de quem usou foi apagada (used_by vira nulo): o código continua usado
update public.invites set used_by = null where code = :'code';
set local role anonymous;
select status as s5b from public.check_invite(:'code') \gset
reset role;
select t.ok(:'s5b' = 'usado', 'conta apagada não libera o convite de novo');
set local role authenticated;
select t.login('user_2terceiro00000000000000c');
select t.throws(format($$ select public.redeem_invite(%L, 'terceiro') $$, :'code'), 'invite_used');
reset role;

update public.invites set used_by = null, used_at = null, expires_at = now() - interval '1 day' where code = :'code';
set local role anonymous;
select status as s6 from public.check_invite(:'code') \gset
reset role;
select t.ok(:'s6' = 'vencido', 'convite vencido');

rollback;

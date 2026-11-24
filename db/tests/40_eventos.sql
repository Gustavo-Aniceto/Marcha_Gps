-- Eventos, "fazer a mídia" e rank interno
begin;
\set adm '00000000-0000-0000-0000-0000000000e1'
\set m   '00000000-0000-0000-0000-0000000000e2'
\set o   '00000000-0000-0000-0000-0000000000e3'
select t.crew('Low Família', 'guarulhos') as x \gset
select t.crew('Bonde ABC') as y \gset
select t.user(:'adm', 'admin.x', :'x', 'verified', 'founder');
select t.user(:'m',   'membro.x', :'x');
select t.user(:'o',   'outro.y',  :'y');

set local role authenticated;

-- membro não cria evento
select t.login(:'m');
select t.throws(format($$ insert into public.events (crew_id, kind, title, starts_at, ends_at, lat, lon, created_by)
                          values (%L, 'encontro', 'Fake', now(), now() + interval '2 hours', -23.46, -46.53, auth.user_id()) $$, :'x'),
                'row-level security');

select t.login(:'adm');
insert into public.events (crew_id, kind, title, starts_at, ends_at, lat, lon, radius_m, created_by)
values (:'x', 'encontro', 'Rolê de sábado', now() - interval '10 minutes', now() + interval '3 hours',
        -23.4600, -46.5300, 200, auth.user_id())
returning id as ev \gset

-- quem é de outra equipe não vê evento fechado
select t.login(:'o');
select t.ok((select count(*) from public.events) = 0, 'evento só da equipe');
select t.throws(format($$ select public.submit_event_media_checked(%L, t.key(), -23.46, -46.53) $$, :'ev'), 'not_crew_member');
select t.throws(format($$ select public.crew_leaderboard(%L) $$, :'x'), 'forbidden');

select t.login(:'m');
select t.throws(format($$ select public.submit_event_media_checked(%L, t.key(), -23.4700, -46.5300) $$, :'ev'), 'outside_event_area');
select public.submit_event_media_checked(:'ev', t.key(), -23.4605, -46.5302) as media \gset
select t.ok((select xp from public.crew_members where crew_id = :'x' and user_id = auth.user_id()) = 50, 'mídia vale 50 XP');
select t.throws(format($$ select public.submit_event_media_checked(%L, t.key(), -23.46, -46.53) $$, :'ev'), 'already_submitted');
select t.throws(format($$ select public.contest_event_media(%L) $$, :'media'), 'forbidden');
select t.ok((select rank_pos from public.crew_leaderboard(:'x') where username = 'membro.x') = 1, 'rank interno');

-- admin contesta: XP volta
select t.login(:'adm');
select public.contest_event_media(:'media');
select t.ok((select xp from public.crew_members where crew_id = :'x' and user_id = :'m') = 0, 'contestada tira os 50');
select t.throws(format($$ select public.contest_event_media(%L) $$, :'media'), 'already_contested');

-- evento acabou: não dá mais
reset role;
update public.events set starts_at = now() - interval '5 hours', ends_at = now() - interval '1 hour' where id = :'ev';
delete from public.event_media where id = :'media';
set local role authenticated;
select t.login(:'m');
select t.throws(format($$ select public.submit_event_media_checked(%L, t.key(), -23.46, -46.53) $$, :'ev'), 'outside_event_time');

-- evento aberto: verificado de outra equipe vê
select t.login(:'adm');
update public.events set visibility = 'open' where id = :'ev';
select t.login(:'o');
select t.ok((select count(*) from public.events) = 1, 'evento aberto aparece pra cena');

rollback;

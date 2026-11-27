-- Reconectar conta antiga travava pra quem já era membro de equipe com confirmação ou check-in:
-- member_vouches e member_checkins apontam pra crew_members (crew_id, user_id) sem ON UPDATE CASCADE,
-- então trocar o id em profiles -> crew_members barrava ("still referenced from member_vouches").
alter table public.member_vouches
  drop constraint member_vouches_crew_id_member_id_fkey,
  add constraint member_vouches_crew_id_member_id_fkey
    foreign key (crew_id, member_id) references public.crew_members (crew_id, user_id)
    on update cascade on delete cascade;

alter table public.member_checkins
  drop constraint member_checkins_crew_id_member_id_fkey,
  add constraint member_checkins_crew_id_member_id_fkey
    foreign key (crew_id, member_id) references public.crew_members (crew_id, user_id)
    on update cascade on delete cascade;

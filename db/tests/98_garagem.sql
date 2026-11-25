begin;
select t.user('user_carX00000000000000000x','car.x') as x \gset
set local role authenticated;
select t.login(:'x');
insert into public.cars (owner_id, make, model, year, color, ride_height_cm, suspension, rim, wheel_position, camber_deg, tint, spoiler, neon, updated_at)
values (:'x','Volkswagen','Gol G5',null,'#B9C0CB',11,'fixa',17,'alinhada',1.5,'nenhuma',false,null, now()) returning id;
update public.cars set year = 2009, updated_at = now() where owner_id = :'x' returning id, year;
select t.throws(format($$ update public.cars set year = 9 where owner_id = %L $$, :'x'), 'cars_year_check');
update public.cars set body_type = 'picape' where owner_id = :'x';
select t.ok((select car->>'body_type' = 'picape' from public.public_profile('car.x')), 'perfil mostra a carroceria');
select t.throws(format($$ update public.cars set body_type = 'foguete' where owner_id = %L $$, :'x'), 'cars_body_type_check');
reset role;
rollback;

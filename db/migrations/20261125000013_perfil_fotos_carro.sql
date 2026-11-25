-- Marcha GPS — o perfil (e o cartão que abre ao tocar num carro no mapa) mostra até 3 fotos reais do carro.

create or replace function public.public_profile(p_username text)
returns table (id text, username text, avatar_key text, joined_at timestamptz, car jsonb, posts bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.avatar_key, p.created_at,
         (select jsonb_build_object('make', c.make, 'model', c.model, 'year', c.year, 'color', c.color,
                                    'ride_height_cm', c.ride_height_cm, 'suspension', c.suspension, 'rim', c.rim,
                                    'neon', c.neon, 'spoiler', c.spoiler,
                                    'body_type', c.body_type, 'tint', c.tint,
                                    'photos', to_jsonb(c.photo_paths[1:3]))
            from public.cars c where c.owner_id = p.id and c.is_active),
         (select count(*) from public.posts x where x.author_id = p.id and x.crew_id is null),
         p.id = auth.user_id()
    from public.profiles p
   where public.has_profile() and p.username = lower(trim(p_username));
$$;

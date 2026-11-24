// Manda a posição pro banco enquanto o mapa está aberto (se a pessoa não está no modo fantasma).
// O banco decide quem pode ver: ver visible_cars() em supabase/migrations.
import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from './supabase';

export function useLocationSharing(share: boolean, activeCrew: string | null) {
  const [position, setPosition] = useState<{ lat: number; lon: number; heading: number | null } | null>(null);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const lastSent = useRef(0);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') { setPermission('denied'); return; }
      setPermission('granted');
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
        (loc) => {
          const heading = loc.coords.heading != null && loc.coords.heading >= 0 ? Math.round(loc.coords.heading) % 360 : null;
          const p = { lat: loc.coords.latitude, lon: loc.coords.longitude, heading };
          setPosition(p);
          const now = Date.now();
          if (share && now - lastSent.current > 10_000) {
            lastSent.current = now;
            supabase.rpc('update_my_location', {
              p_lat: p.lat, p_lon: p.lon, p_heading: heading, p_active_crew: activeCrew,
            }).then(({ error }) => { if (error) console.warn('update_my_location', error.message); });
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [share, activeCrew]);

  // virou fantasma: apaga a posição na hora
  useEffect(() => {
    if (!share) supabase.rpc('stop_sharing_location').then(() => {});
  }, [share]);

  return { position, permission };
}

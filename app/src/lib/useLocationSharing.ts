// Manda a posição pro banco enquanto o mapa está aberto (se a pessoa não está no modo fantasma).
// O banco decide quem pode ver: ver visible_cars() em db/migrations.
import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { db } from './db';
import { bearing, distM } from './nav.ts';

export interface Position { lat: number; lon: number; heading: number | null; accuracy: number | null; speed: number | null }

/** `fast`: durante a navegação lê o GPS a cada segundo (senão a cada 5 s / 15 m). */
export function useLocationSharing(share: boolean, activeCrew: string | null, fast = false) {
  const [position, setPosition] = useState<Position | null>(null);
  const prev = useRef<Position | null>(null);
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
        fast
          ? { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 }
          : { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
        (loc) => {
          let heading = loc.coords.heading != null && loc.coords.heading >= 0 ? Math.round(loc.coords.heading) % 360 : null;
          const here = { lat: loc.coords.latitude, lon: loc.coords.longitude };
          const last = prev.current;
          // vários navegadores não mandam a direção: calcula pelo movimento
          if (heading == null && last) {
            heading = distM(last, here) > 6 ? Math.round(bearing(last, here)) % 360 : last.heading;
          }
          const p: Position = {
            ...here, heading,
            accuracy: loc.coords.accuracy ?? null,
            speed: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : null,
          };
          prev.current = p;
          setPosition(p);
          const now = Date.now();
          if (share && now - lastSent.current > 10_000) {
            lastSent.current = now;
            db.rpc('update_my_location', {
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
  }, [share, activeCrew, fast]);

  // virou fantasma: apaga a posição na hora
  useEffect(() => {
    if (!share) db.rpc('stop_sharing_location').then(() => {});
  }, [share]);

  return { position, permission };
}

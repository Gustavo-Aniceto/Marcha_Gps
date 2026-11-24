// Manda a posição pro banco enquanto o mapa está aberto (se a pessoa não está no modo fantasma).
// O banco decide quem pode ver: ver visible_cars() em db/migrations.
import { useEffect, useRef, useState } from 'react';
import { db } from './db';
import { bearing, distM } from './nav.ts';
import { startWatch } from './watchLocation';

export interface Position { lat: number; lon: number; heading: number | null; accuracy: number | null; speed: number | null }

/** `fast`: durante a navegação lê o GPS a cada segundo (senão a cada 5 s / 15 m). */
export function useLocationSharing(share: boolean, activeCrew: string | null, fast = false) {
  const [attempt, setAttempt] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const prev = useRef<Position | null>(null);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied' | 'unavailable'>('unknown');
  const lastSent = useRef(0);
  const live = useRef({ share, activeCrew });
  live.current = { share, activeCrew };

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;

    startWatch(fast, (raw) => {
      if (cancelled) return;
      setPermission('granted');
      let heading = raw.heading != null ? Math.round(raw.heading) % 360 : null;
      const here = { lat: raw.lat, lon: raw.lon };
      const last = prev.current;
      // vários navegadores não mandam a direção: calcula pelo movimento
      if (heading == null && last) {
        heading = distM(last, here) > 6 ? Math.round(bearing(last, here)) % 360 : last.heading;
      }
      const p: Position = { ...here, heading, accuracy: raw.accuracy, speed: raw.speed };
      prev.current = p;
      setPosition(p);
      const now = Date.now();
      if (live.current.share && now - lastSent.current > 10_000) {
        lastSent.current = now;
        db.rpc('update_my_location', {
          p_lat: p.lat, p_lon: p.lon, p_heading: heading, p_active_crew: live.current.activeCrew,
        }).then(({ error }) => { if (error) console.warn('update_my_location', error.message); });
      }
    }, (err) => {
      if (cancelled) return;
      if (err === 'negado') setPermission('denied');
      else if (err === 'indisponivel' && !prev.current) setPermission('unavailable');
    }).then((s) => { if (cancelled) s(); else stop = s; })
      .catch(() => { if (!cancelled && !prev.current) setPermission('unavailable'); });

    return () => { cancelled = true; stop?.(); };
  }, [fast, attempt]);

  // virou fantasma: apaga a posição na hora
  useEffect(() => {
    if (!share) db.rpc('stop_sharing_location').then(() => {});
  }, [share]);

  /** Tenta de novo (ex.: depois de liberar a localização). Chamar num toque ajuda o Safari a perguntar. */
  const retry = () => { setPermission('unknown'); setAttempt((n) => n + 1); };
  return { position, permission, retry };
}

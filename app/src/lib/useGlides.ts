// Um Glide por carro dos outros (a posição deles chega a cada ~10–15 s): no mapa eles deslizam em vez de pular.
import { useEffect, useRef } from 'react';
import { Glide } from './glide.ts';

export function useGlides(cars: { user_id: string; lat: number; lon: number; heading: number | null }[]) {
  const glides = useRef(new Map<string, Glide>());
  useEffect(() => {
    const now = performance.now();
    const seen = new Set<string>();
    for (const c of cars) {
      seen.add(c.user_id);
      let g = glides.current.get(c.user_id);
      if (!g) { g = new Glide({ maxMs: 16_000, teleportM: 800 }); glides.current.set(c.user_id, g); }
      g.push({ lat: c.lat, lon: c.lon, heading: c.heading }, now);
    }
    for (const id of [...glides.current.keys()]) if (!seen.has(id)) glides.current.delete(id);
  }, [cars]);
  // cria na hora se o carro apareceu agora (o efeito acima roda depois do desenho)
  return (c: { user_id: string; lat: number; lon: number; heading: number | null }) => {
    let g = glides.current.get(c.user_id);
    if (!g) {
      g = new Glide({ maxMs: 16_000, teleportM: 800 });
      g.push({ lat: c.lat, lon: c.lon, heading: c.heading }, performance.now());
      glides.current.set(c.user_id, g);
    }
    return g;
  };
}

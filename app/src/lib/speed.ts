// Velocidade atual (velocímetro) e limite do radar à frente.
// Só mostra a velocidade pra própria pessoa: nada é guardado nem comparado entre carros.
import { angleDiff, bearing, distM } from './nav.ts';

export interface SpeedFix { lat: number; lon: number; t: number; speed: number | null; accuracy: number | null }

/** Velocidade em m/s: a do GPS quando vem; senão, distância/tempo entre duas leituras. */
export function estimateSpeedMs(prev: SpeedFix | null, cur: SpeedFix): number | null {
  if (cur.speed != null && Number.isFinite(cur.speed) && cur.speed >= 0) return cur.speed;
  if (!prev) return null;
  const dt = (cur.t - prev.t) / 1000;
  if (dt < 0.5 || dt > 30) return null;
  const acc = cur.accuracy ?? 0;
  if (acc > 50) return null; // GPS ruim demais pra calcular
  const d = distM(prev, cur);
  if (d < Math.max(3, acc * 0.5)) return 0; // parado (o ponto "treme" um pouco)
  return d / dt;
}

/** Suaviza pra o número não ficar pulando; parar zera rápido. */
export function smoothKmh(prevKmh: number | null, ms: number | null): number | null {
  if (ms == null) return prevKmh;
  const kmh = ms * 3.6;
  if (prevKmh == null || kmh < 3) return kmh < 3 ? 0 : kmh;
  return prevKmh * 0.4 + kmh * 0.6;
}

export const toKmh = (ms: number) => Math.round(ms * 3.6);

export interface RadarLike { lat: number; lon: number; kind: string; speed_limit: number | null }

/**
 * Radar com velocidade mais perto à frente (até `maxDist` m). Com direção conhecida, só conta
 * o que está na frente (até 50° pro lado); sem direção, só o que está bem perto (150 m).
 */
export function radarAhead<T extends RadarLike>(radars: T[], pos: { lat: number; lon: number },
  heading: number | null, maxDist = 400): { radar: T; dist: number } | null {
  let best: { radar: T; dist: number } | null = null;
  for (const r of radars) {
    if (r.kind !== 'radar' || r.speed_limit == null) continue;
    const dist = distM(pos, r);
    if (dist > (heading == null ? Math.min(150, maxDist) : maxDist)) continue;
    if (heading != null && dist > 25 && angleDiff(heading, bearing(pos, r)) > 50) continue;
    if (!best || dist < best.dist) best = { radar: r, dist };
  }
  return best;
}

/** Acima do limite (o número que aparece no velocímetro, já arredondado). */
export const isOverLimit = (kmh: number | null, limit: number | null | undefined) =>
  kmh != null && limit != null && Math.round(kmh) > limit;

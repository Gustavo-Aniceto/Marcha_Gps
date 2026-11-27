// O app vale em todas as regiões: pra os avisos do OpenStreetMap (lombada, valeta, radar) chegarem
// onde a galera anda, o app marca no banco os quadrados de 0,2° (~22 km) da posição e da rota
// (mark_areas). O servidor importa os quadrados marcados. Mesma conta de area_cell() no banco.
import { densify, type LatLon } from './offline.ts';

export const CELL = 0.2;
export const MAX_POINTS = 40;

export function cellId(p: LatLon): string {
  return `g${Math.floor((p.lat + 90) / CELL + 1e-9)}_${Math.floor((p.lon + 180) / CELL + 1e-9)}`;
}

/** Um ponto por quadrado, na ordem do caminho, no máximo MAX_POINTS (espalhados se passar). Pula os já marcados. */
export function areaPoints(coords: LatLon[], already: Set<string> = new Set()): LatLon[] {
  const seen = new Set<string>();
  const out: LatLon[] = [];
  for (const p of densify(coords, 4000)) {
    const id = cellId(p);
    if (seen.has(id) || already.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  if (out.length <= MAX_POINTS) return out;
  const step = out.length / MAX_POINTS;
  return Array.from({ length: MAX_POINTS }, (_, i) => out[Math.floor(i * step)]);
}

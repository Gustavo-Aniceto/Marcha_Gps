// Manda pro banco os quadrados por onde a pessoa anda/vai (ver areas.ts). Cada quadrado vai uma vez por sessão.
import { db } from './db';
import { areaPoints, cellId } from './areas.ts';
import type { LatLon } from './offline.ts';

const sent = new Set<string>();

export async function markAreas(coords: LatLon[]): Promise<void> {
  const pts = areaPoints(coords, sent);
  if (!pts.length) return;
  pts.forEach((p) => sent.add(cellId(p)));
  const { error } = await db.rpc('mark_areas', { p_lats: pts.map((p) => p.lat), p_lons: pts.map((p) => p.lon) });
  if (error) pts.forEach((p) => sent.delete(cellId(p)));  // tenta de novo na próxima
}

// Rota sem internet: quais quadradinhos do mapa guardar em volta da rota (o service worker baixa
// e guarda). O OpenFreeMap tem detalhe até o zoom 14; de perto o mapa só amplia esses.
export interface LatLon { lat: number; lon: number }
export type Tile = [z: number, x: number, y: number];

export const OFFLINE_ZOOMS = [10, 11, 12, 13, 14];
export const MAX_TILES = 500;

export function tileOf(p: LatLon, z: number): [number, number] {
  const n = 2 ** z;
  const x = Math.floor(((p.lon + 180) / 360) * n);
  const lat = (Math.max(-85.05, Math.min(85.05, p.lat)) * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n);
  return [Math.min(n - 1, Math.max(0, x)), Math.min(n - 1, Math.max(0, y))];
}

/** Pontos da rota a cada ~stepM metros (pra não pular quadradinho em reta comprida). */
export function densify(coords: LatLon[], stepM = 400): LatLon[] {
  const out: LatLon[] = [];
  for (let i = 0; i < coords.length; i++) {
    const a = coords[i];
    out.push(a);
    const b = coords[i + 1];
    if (!b) break;
    const dLat = (b.lat - a.lat) * 111_320;
    const dLon = (b.lon - a.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
    const n = Math.floor(Math.hypot(dLat, dLon) / stepM);
    for (let k = 1; k <= n; k++) out.push({ lat: a.lat + ((b.lat - a.lat) * k) / (n + 1), lon: a.lon + ((b.lon - a.lon) * k) / (n + 1) });
  }
  return out;
}

/** Quadradinhos em volta da rota (zoom mais aberto primeiro; corta em `max`). `pad` = vizinhos de cada lado. */
export function tilesAlongRoute(coords: LatLon[], zooms = OFFLINE_ZOOMS, pad = 1, max = MAX_TILES): Tile[] {
  const pts = densify(coords);
  const out: Tile[] = [];
  const seen = new Set<string>();
  for (const z of zooms) {
    const n = 2 ** z;
    for (const p of pts) {
      const [x, y] = tileOf(p, z);
      for (let dx = -pad; dx <= pad; dx++) {
        for (let dy = -pad; dy <= pad; dy++) {
          const tx = x + dx, ty = y + dy;
          if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
          const k = `${z}/${tx}/${ty}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push([z, tx, ty]);
          if (out.length >= max) return out;
        }
      }
    }
  }
  return out;
}

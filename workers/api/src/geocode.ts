// Busca de endereço/lugar pelo Photon (OpenStreetMap, servidor público da Komoot).
// Uso justo: o Worker guarda em cache e limita por pessoa.

export const PHOTON_URL = 'https://photon.komoot.io/api/';

// Brasil inteiro (o app vale em todas as regiões); a posição da pessoa puxa os resultados pra perto.
export const SEARCH_BBOX = [-74.1, -33.9, -28.8, 5.4] as const; // minLon, minLat, maxLon, maxLat

export interface Place {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lon: number;
}

export function normalizeQuery(q: string): string {
  return q.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function photonUrl(q: string, bias?: { lat: number; lon: number } | null, limit = 8): string {
  const u = new URL(PHOTON_URL);
  u.searchParams.set('q', normalizeQuery(q));
  u.searchParams.set('limit', String(limit));
  u.searchParams.set('bbox', SEARCH_BBOX.join(','));
  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lon)) {
    // 2 casas (~1 km) basta pra puxar resultados perto e ajuda o cache
    u.searchParams.set('lat', bias.lat.toFixed(2));
    u.searchParams.set('lon', bias.lon.toFixed(2));
  }
  return u.toString();
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | number | undefined>;
}

export function parsePhoton(body: unknown): Place[] {
  const feats = (body as { features?: PhotonFeature[] })?.features;
  if (!Array.isArray(feats)) return [];
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const f of feats) {
    const c = f.geometry?.coordinates;
    const p = f.properties ?? {};
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const street = p.street ? String(p.street) : '';
    const number = p.housenumber ? String(p.housenumber) : '';
    const name = p.name ? String(p.name) : street ? (number ? `${street}, ${number}` : street) : '';
    if (!name) continue;
    const parts = [
      p.name && street ? (number ? `${street}, ${number}` : street) : '',
      p.district ? String(p.district) : '',
      p.city ? String(p.city) : p.county ? String(p.county) : '',
    ].filter((x, i, a) => x && a.indexOf(x) === i && x !== name);
    const id = `${p.osm_type ?? ''}${p.osm_id ?? `${c[1].toFixed(5)},${c[0].toFixed(5)}`}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, detail: parts.join(' · '), lat: c[1], lon: c[0] });
  }
  return out;
}

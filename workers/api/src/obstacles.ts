// Importação semanal de lombadas, valetas e radares do OpenStreetMap (Overpass).
// O Worker só baixa o texto e repassa: quem lê, filtra e junta duplicados é o banco
// (função import_osm_obstacles), pra caber no limite de CPU do Worker.

// Servidores públicos do Overpass: se um falhar ou estiver lotado, tenta o próximo.
export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// O mapa das 3 cidades em 3 faixas (oeste -> leste). Consulta por caixa é bem mais leve pro
// Overpass que por limite de município; o banco descobre a cidade de cada ponto pela posição.
export interface Tile { id: string; south: number; west: number; north: number; east: number }
export const TILES: Tile[] = [
  { id: 'faixa_oeste', south: -24.01, west: -46.83, north: -23.29, east: -46.64 },
  { id: 'faixa_centro', south: -24.01, west: -46.64, north: -23.29, east: -46.47 },
  { id: 'faixa_leste', south: -24.01, west: -46.47, north: -23.29, east: -46.30 },
];

/** Consulta em CSV (tab): tipo, id, lat, lon, traffic_calming, highway, hazard, maxspeed. */
export function overpassQuery(t: Tile): string {
  const box = [t.south, t.west, t.north, t.east].map((n) => Number(n).toFixed(4)).join(',');
  return `[out:csv(::type,::id,::lat,::lon,traffic_calming,highway,hazard,maxspeed;false;"\\t")][timeout:150][bbox:${box}];
(
  node["traffic_calming"];
  way["traffic_calming"];
  node["highway"="speed_camera"];
  node["hazard"="bump"];
);
out center;`;
}

/** Endereço do SQL por HTTP do Neon a partir da connection string. */
export function neonSqlUrl(connectionString: string): string {
  const host = new URL(connectionString.replace(/^postgres(ql)?:/, 'https:')).hostname.replace('-pooler.', '.');
  return `https://${host}/sql`;
}

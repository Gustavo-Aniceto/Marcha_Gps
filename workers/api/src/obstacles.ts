// Importação semanal de lombadas, valetas e radares do OpenStreetMap (Overpass).
// O Worker só baixa o texto e repassa: quem lê, filtra e junta duplicados é o banco
// (função import_osm_obstacles), pra caber no limite de CPU do Worker.

// Servidores públicos do Overpass: se um falhar ou estiver lotado, tenta o próximo.
export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// O mapa das 3 cidades em 12 quadrados (3 colunas oeste->leste x 4 linhas norte->sul).
// Pedaço pequeno + tempo curto ([timeout:25]) faz os servidores públicos aceitarem a consulta
// mesmo quando estão cheios; com prazo longo eles deixam na fila e a conexão cai (erro 524).
// O banco descobre a cidade de cada ponto pela posição.
export interface Tile { id: string; south: number; west: number; north: number; east: number }
const COLS: [string, number, number][] = [
  ['oeste', -46.83, -46.64],
  ['centro', -46.64, -46.47],
  ['leste', -46.47, -46.30],
];
const ROWS: [number, number][] = [
  [-23.47, -23.29],
  [-23.65, -23.47],
  [-23.83, -23.65],
  [-24.01, -23.83],
];
/** Quadrado de 0,2° (~22 km) que o app marcou por onde a galera anda: id g<linha>_<coluna> (mesma conta de area_cell() no banco). */
export const CELL = 0.2;
export function cellId(lat: number, lon: number): string {
  return `g${Math.floor((lat + 90) / CELL + 1e-9)}_${Math.floor((lon + 180) / CELL + 1e-9)}`;
}
export function cellTile(id: string): Tile | null {
  const m = /^g(\d{1,4})_(\d{1,4})$/.exec(id);
  if (!m) return null;
  const south = +(Number(m[1]) * CELL - 90).toFixed(4), west = +(Number(m[2]) * CELL - 180).toFixed(4);
  if (south < -90 || south >= 90 || west < -180 || west >= 180) return null;
  return { id, south, west, north: +(south + CELL).toFixed(4), east: +(west + CELL).toFixed(4) };
}

// Os 12 quadrados fixos da área onde o app começou (SP, Guarulhos, Itaquá); o resto vem dos quadrados marcados.
export const TILES: Tile[] = ROWS.flatMap(([south, north], r) =>
  COLS.map(([name, west, east]) => ({ id: `${name}_${'abcd'[r]}`, south, west, north, east })),
);

/** Consulta em CSV (tab): tipo, id, lat, lon, traffic_calming, highway, hazard, maxspeed. */
export function overpassQuery(t: Tile): string {
  const box = [t.south, t.west, t.north, t.east].map((n) => Number(n).toFixed(4)).join(',');
  return `[out:csv(::type,::id,::lat,::lon,traffic_calming,highway,hazard,maxspeed;false;"\\t")][timeout:25][bbox:${box}];
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

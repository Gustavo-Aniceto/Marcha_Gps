// Importação semanal de lombadas, valetas e radares do OpenStreetMap (Overpass).
// O Worker só baixa o texto e repassa: quem lê, filtra e junta duplicados é o banco
// (função import_osm_obstacles), pra caber no limite de CPU do Worker.

// Servidores públicos do Overpass: se um falhar ou estiver lotado, tenta o próximo.
export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export const CITIES: Record<string, string> = {
  sao_paulo: 'São Paulo',
  guarulhos: 'Guarulhos',
  itaquaquecetuba: 'Itaquaquecetuba',
};

// Cada disparo do agendamento importa uma cidade (um pedido por vez pro Overpass).
// Agendamento: "7,17,27 6 * * 1" -> minuto 7 Itaquá, 17 Guarulhos, 27 São Paulo (37/47/57 repetem a ordem).
const ORDER = ['itaquaquecetuba', 'guarulhos', 'sao_paulo'];
export function cityForMinute(minute: number): string | null {
  if (minute % 10 !== 7) return null;
  return ORDER[Math.floor(minute / 10) % 3];
}

/** Consulta em CSV (tab): tipo, id, lat, lon, traffic_calming, highway, hazard, maxspeed. */
export function overpassQuery(cityName: string): string {
  const name = cityName.replace(/["\\]/g, '');
  return `[out:csv(::type,::id,::lat,::lon,traffic_calming,highway,hazard,maxspeed;false;"\\t")][timeout:180];
area["boundary"="administrative"]["admin_level"="8"]["name"="${name}"]->.c;
(
  node["traffic_calming"](area.c);
  way["traffic_calming"](area.c);
  node["highway"="speed_camera"](area.c);
  node["hazard"="bump"](area.c);
);
out center;`;
}

/** Endereço do SQL por HTTP do Neon a partir da connection string. */
export function neonSqlUrl(connectionString: string): string {
  const host = new URL(connectionString.replace(/^postgres(ql)?:/, 'https:')).hostname.replace('-pooler.', '.');
  return `https://${host}/sql`;
}

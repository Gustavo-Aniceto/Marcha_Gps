// Rota pelo Valhalla (OpenStreetMap, servidor público do FOSSGIS: no máximo 1 pedido por segundo).
// O app recebe só o necessário: linha da rota (polyline6), distância, tempo e manobras em português.

export const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';

export interface Point { lat: number; lon: number }
export interface From extends Point { heading?: number | null }

export type ManeuverKind =
  | 'depart' | 'arrive' | 'straight' | 'slight_right' | 'right' | 'sharp_right'
  | 'slight_left' | 'left' | 'sharp_left' | 'uturn' | 'roundabout' | 'merge' | 'ramp_right' | 'ramp_left';

export interface Maneuver {
  kind: ManeuverKind;
  text: string;        // instrução escrita
  speak: string;       // frase falada antes da manobra
  distance_m: number;  // tamanho do trecho que começa nesta manobra
  time_s: number;
  begin: number;       // índice do ponto da linha onde a manobra acontece
  street: string;
  exit?: number;       // rotatória: número da saída
}

export interface Route {
  shape: string;       // polyline com 6 casas (Valhalla)
  distance_m: number;
  time_s: number;
  maneuvers: Maneuver[];
}

export function validPoint(p: unknown): p is Point {
  const q = p as Point;
  return !!q && Number.isFinite(q.lat) && Number.isFinite(q.lon)
    && Math.abs(q.lat) <= 90 && Math.abs(q.lon) <= 180;
}

export function valhallaBody(from: From, to: Point) {
  const start: Record<string, unknown> = { lat: from.lat, lon: from.lon, type: 'break' };
  // com a direção do carro, a rota não manda dar meia-volta logo de cara (importante no recálculo)
  if (from.heading != null && Number.isFinite(from.heading)) {
    start.heading = Math.round(((from.heading % 360) + 360) % 360);
    start.heading_tolerance = 60;
  }
  return {
    locations: [start, { lat: to.lat, lon: to.lon, type: 'break' }],
    costing: 'auto',
    directions_options: { units: 'kilometers', language: 'pt-BR' },
  };
}

// Tipos de manobra do Valhalla -> ícone do app
const KIND: Record<number, ManeuverKind> = {
  1: 'depart', 2: 'depart', 3: 'depart',
  4: 'arrive', 5: 'arrive', 6: 'arrive',
  7: 'straight', 8: 'straight', 22: 'straight', 17: 'straight',
  9: 'slight_right', 10: 'right', 11: 'sharp_right',
  12: 'uturn', 13: 'uturn',
  14: 'sharp_left', 15: 'left', 16: 'slight_left',
  18: 'ramp_right', 20: 'ramp_right', 23: 'slight_right',
  19: 'ramp_left', 21: 'ramp_left', 24: 'slight_left',
  25: 'merge', 37: 'merge', 38: 'merge',
  26: 'roundabout', 27: 'roundabout',
};

interface VManeuver {
  type?: number; instruction?: string; verbal_pre_transition_instruction?: string;
  length?: number; time?: number; begin_shape_index?: number; street_names?: string[];
  roundabout_exit_count?: number;
}

export class RouteError extends Error {}

export function parseValhalla(body: unknown): Route {
  const b = body as { trip?: { legs?: { shape?: string; maneuvers?: VManeuver[] }[]; summary?: { length?: number; time?: number } };
                      error_code?: number; error?: string };
  if (b?.error_code != null) {
    // 442/443: sem caminho; 171: ponto longe de qualquer rua
    throw new RouteError(b.error_code === 171 ? 'longe_da_rua' : b.error_code === 442 || b.error_code === 443 ? 'sem_caminho' : 'rota_indisponivel');
  }
  const leg = b?.trip?.legs?.[0];
  if (!leg?.shape || !Array.isArray(leg.maneuvers)) throw new RouteError('rota_indisponivel');
  return {
    shape: leg.shape,
    distance_m: Math.round((b.trip?.summary?.length ?? 0) * 1000),
    time_s: Math.round(b.trip?.summary?.time ?? 0),
    maneuvers: leg.maneuvers.map((m) => ({
      kind: KIND[m.type ?? 0] ?? 'straight',
      text: m.instruction ?? '',
      speak: m.verbal_pre_transition_instruction ?? m.instruction ?? '',
      distance_m: Math.round((m.length ?? 0) * 1000),
      time_s: Math.round(m.time ?? 0),
      begin: m.begin_shape_index ?? 0,
      street: m.street_names?.[0] ?? '',
      ...(m.roundabout_exit_count ? { exit: m.roundabout_exit_count } : {}),
    })),
  };
}

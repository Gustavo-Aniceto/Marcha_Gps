// Navegação: segue a rota, avisa a próxima manobra, percebe quando saiu do caminho (pra recalcular)
// e quando chegou. Lógica pura (sem tela), testada em __tests__/nav.test.ts.

export type ManeuverKind =
  | 'depart' | 'arrive' | 'straight' | 'slight_right' | 'right' | 'sharp_right'
  | 'slight_left' | 'left' | 'sharp_left' | 'uturn' | 'roundabout' | 'merge' | 'ramp_right' | 'ramp_left';

export interface Maneuver {
  kind: ManeuverKind;
  text: string;
  speak: string;
  distance_m: number;
  time_s: number;
  begin: number;
  street: string;
  exit?: number;
}

/** Como vem do serviço de rotas (workers/api). */
export interface RouteResponse {
  shape: string;
  distance_m: number;
  time_s: number;
  maneuvers: Maneuver[];
}

export interface LatLon { lat: number; lon: number }

export interface Route {
  coords: LatLon[];
  cum: number[];          // distância acumulada (m) até cada ponto
  total_m: number;
  time_s: number;
  maneuvers: Maneuver[];
}

export interface Fix extends LatLon {
  heading?: number | null;   // graus, 0 = norte
  accuracy?: number | null;  // metros
  speed?: number | null;     // m/s
}

// ---------- geometria ----------

/** Linha do Valhalla: polyline com 6 casas decimais. */
export function decodePolyline6(str: string): LatLon[] {
  const out: LatLon[] = [];
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d; else lon += d;
    }
    out.push({ lat: lat / 1e6, lon: lon / 1e6 });
  }
  return out;
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distM(a: LatLon, b: LatLon): number {
  const x = rad(b.lon - a.lon) * Math.cos(rad((a.lat + b.lat) / 2));
  const y = rad(b.lat - a.lat);
  return Math.sqrt(x * x + y * y) * R;
}

export function bearing(a: LatLon, b: LatLon): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function buildRoute(r: RouteResponse): Route {
  const coords = decodePolyline6(r.shape);
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + distM(coords[i - 1], coords[i]));
  return { coords, cum, total_m: cum[cum.length - 1] ?? 0, time_s: r.time_s, maneuvers: r.maneuvers };
}

export interface Snap {
  seg: number;        // segmento coords[seg] -> coords[seg+1]
  along: number;      // metros percorridos na rota
  off: number;        // distância da rota (m)
  point: LatLon;
  segBearing: number;
}

/** Encaixa a posição no trecho mais perto da rota. Procura perto do último encaixe pra não pular pra outra parte. */
export function snapToRoute(route: Route, p: LatLon, hint = 0): Snap {
  const n = route.coords.length;
  if (n < 2) {
    const only = route.coords[0] ?? p;
    return { seg: 0, along: 0, off: distM(only, p), point: only, segBearing: 0 };
  }
  const search = (from: number, to: number) => {
    let best: Snap | null = null;
    const cosLat = Math.cos(rad(p.lat));
    for (let i = Math.max(0, from); i < Math.min(n - 1, to); i++) {
      const a = route.coords[i], b = route.coords[i + 1];
      // plano local em metros
      const ax = 0, ay = 0;
      const bx = rad(b.lon - a.lon) * cosLat * R, by = rad(b.lat - a.lat) * R;
      const px = rad(p.lon - a.lon) * cosLat * R, py = rad(p.lat - a.lat) * R;
      const len2 = bx * bx + by * by;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len2)) : 0;
      const qx = bx * t, qy = by * t;
      const off = Math.hypot(px - qx, py - qy);
      if (!best || off < best.off) {
        const segLen = route.cum[i + 1] - route.cum[i];
        best = {
          seg: i, along: route.cum[i] + segLen * t, off,
          point: { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t },
          segBearing: bearing(a, b),
        };
      }
    }
    return best!;
  };
  const near = search(hint - 3, hint + 80);
  if (near.off < 60) return near;
  const all = search(0, n - 1);
  return all.off < near.off ? all : near;
}

// ---------- estado da navegação ----------

export const OFF_ROUTE_M = 40;          // fora da rota a partir daqui (somado à imprecisão do GPS)
export const OFF_ROUTE_FIXES = 2;       // quantas leituras seguidas fora pra recalcular
export const FAR_OFF_ROUTE_M = 120;     // muito longe: recalcula na hora
export const WRONG_WAY_FIXES = 3;       // andando ao contrário da rota
export const ARRIVE_M = 30;
export const FAR_ANNOUNCE_M = 400;
export const NEAR_ANNOUNCE_M = 70;

export interface NavState {
  hint: number;
  offCount: number;
  wrongWayCount: number;
  announced: string[];    // "indice:etapa" já falados
}

export const initialNavState = (): NavState => ({ hint: 0, offCount: 0, wrongWayCount: 0, announced: [] });

export interface NavUpdate {
  state: NavState;
  snap: Snap;
  needsReroute: boolean;
  arrived: boolean;
  next: { index: number; maneuver: Maneuver; distance_m: number } | null;
  after: Maneuver | null;     // a manobra seguinte (pra "depois, vire...")
  remaining_m: number;
  remaining_s: number;
  speak: string | null;       // frase pra falar agora (se tiver)
}

export function navStep(route: Route, prev: NavState, fix: Fix): NavUpdate {
  const snap = snapToRoute(route, fix, prev.hint);
  const tolerance = OFF_ROUTE_M + Math.min(Math.max(fix.accuracy ?? 0, 0), 60) * 0.5;
  const isOff = snap.off > tolerance;
  const offCount = isOff ? prev.offCount + 1 : 0;

  const moving = (fix.speed ?? 0) > 2;
  const wrongWay = moving && fix.heading != null && angleDiff(fix.heading, snap.segBearing) > 135;
  const wrongWayCount = wrongWay && !isOff ? prev.wrongWayCount + 1 : 0;

  const remaining_m = Math.max(0, route.total_m - snap.along);
  const arrived = !isOff && (remaining_m < ARRIVE_M
    || distM(fix, route.coords[route.coords.length - 1]) < ARRIVE_M);

  const needsReroute = !arrived && (snap.off > FAR_OFF_ROUTE_M || offCount >= OFF_ROUTE_FIXES
    || wrongWayCount >= WRONG_WAY_FIXES);

  // próxima manobra: a primeira que acontece depois de onde estou (a de saída não conta)
  let nextIdx = -1;
  for (let i = 0; i < route.maneuvers.length; i++) {
    const m = route.maneuvers[i];
    if (m.kind === 'depart') continue;
    if (route.cum[Math.min(m.begin, route.cum.length - 1)] > snap.along + 1) { nextIdx = i; break; }
  }
  const next = nextIdx >= 0 ? {
    index: nextIdx,
    maneuver: route.maneuvers[nextIdx],
    distance_m: route.cum[Math.min(route.maneuvers[nextIdx].begin, route.cum.length - 1)] - snap.along,
  } : null;
  const after = nextIdx >= 0 ? route.maneuvers[nextIdx + 1] ?? null : null;

  // voz: aviso de longe (400 m) e na hora (70 m); cada um uma vez só
  let speak: string | null = null;
  const announced = [...prev.announced];
  if (next && !needsReroute && !arrived) {
    const keyNear = `${next.index}:perto`, keyFar = `${next.index}:longe`;
    if (next.distance_m <= NEAR_ANNOUNCE_M && !announced.includes(keyNear)) {
      speak = next.maneuver.speak || next.maneuver.text;
      announced.push(keyNear, keyFar);
    } else if (next.distance_m <= FAR_ANNOUNCE_M && next.distance_m > NEAR_ANNOUNCE_M * 2 && !announced.includes(keyFar)) {
      speak = `Em ${spokenDistance(next.distance_m)}, ${lowerFirst(next.maneuver.text)}`;
      announced.push(keyFar);
    }
  }
  if (arrived && !announced.includes('chegou')) {
    speak = 'Você chegou ao destino.';
    announced.push('chegou');
  }

  const remaining_s = route.total_m > 0 ? Math.round(route.time_s * (remaining_m / route.total_m)) : 0;
  return {
    state: { hint: snap.seg, offCount, wrongWayCount, announced },
    snap, needsReroute, arrived, next, after, remaining_m, remaining_s, speak,
  };
}

// ---------- obstáculos na rota ----------

export interface ObstacleLike extends LatLon { id: string }

/** Obstáculos a até `maxOff` metros da linha da rota, com a posição deles ao longo da rota. */
export function obstaclesOnRoute<T extends ObstacleLike>(route: Route, items: T[], maxOff = 20): { item: T; along: number }[] {
  const out: { item: T; along: number }[] = [];
  for (const it of items) {
    const s = snapToRoute(route, it, 0);
    if (s.off <= maxOff) out.push({ item: it, along: s.along });
  }
  return out.sort((a, b) => a.along - b.along);
}

/** O próximo obstáculo à frente (até `within` metros). */
export function nextObstacle<T extends ObstacleLike>(onRoute: { item: T; along: number }[], along: number, within = 300) {
  for (const o of onRoute) {
    const d = o.along - along;
    if (d > -10 && d <= within) return { item: o.item, distance_m: Math.max(0, d) };
    if (d > within) break;
  }
  return null;
}

// ---------- textos ----------

export function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

export function spokenDistance(m: number): string {
  if (m >= 1000) {
    const km = Math.round(m / 100) / 10;
    return `${String(km).replace('.', ',')} quilômetro${km === 1 ? '' : 's'}`;
  }
  const r = m >= 100 ? Math.round(m / 50) * 50 : Math.max(10, Math.round(m / 10) * 10);
  return `${r} metros`;
}

export function formatDistance(m: number): string {
  if (m >= 1000) return `${(Math.round(m / 100) / 10).toFixed(1).replace('.', ',')} km`;
  if (m >= 100) return `${Math.round(m / 10) * 10} m`;
  return `${Math.max(0, Math.round(m))} m`;
}

export function formatDuration(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatArrival(now: Date, seconds: number): string {
  const t = new Date(now.getTime() + seconds * 1000);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** Mensagem pra cada erro do serviço de rotas. */
export function routeErrorText(code: string): string {
  switch (code) {
    case 'sem_caminho': return 'Não achei caminho de carro até esse lugar.';
    case 'longe_da_rua': return 'Esse ponto está longe de qualquer rua. Escolha um endereço.';
    case 'muitas_rotas': case 'servidor_ocupado': return 'Muitos pedidos agora. Tenta de novo em alguns segundos.';
    case 'muitas_buscas': return 'Muitas buscas seguidas. Espera um pouco.';
    case 'nao_autenticado': case 'token_vencido': return 'Sua sessão expirou. Entre de novo.';
    default: return 'Rota indisponível agora. Tenta de novo.';
  }
}

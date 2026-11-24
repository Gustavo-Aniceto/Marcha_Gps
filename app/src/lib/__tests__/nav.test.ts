import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoute, decodePolyline6, distM, formatArrival, formatDistance, formatDuration, initialNavState,
  navStep, nextObstacle, obstaclesOnRoute, routeErrorText, snapToRoute, spokenDistance, type Maneuver, type NavState,
} from '../nav.ts';

// codificador de teste (mesmo formato do Valhalla, 6 casas)
function encode(points: [number, number][]): string {
  let out = '', plat = 0, plon = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1, s = '';
    while (n >= 0x20) { s += String.fromCharCode((0x20 | (n & 0x1f)) + 63); n >>= 5; }
    return s + String.fromCharCode(n + 63);
  };
  for (const [lat, lon] of points) {
    const la = Math.round(lat * 1e6), lo = Math.round(lon * 1e6);
    out += enc(la - plat) + enc(lo - plon);
    plat = la; plon = lo;
  }
  return out;
}

// Rota em "L": 1 km pro norte e vira à direita, mais 500 m pro leste.
const A: [number, number] = [-23.5000, -46.6000];
const B: [number, number] = [-23.4910, -46.6000];   // ~1000 m ao norte
const C: [number, number] = [-23.4910, -46.5951];   // ~500 m a leste
const pts: [number, number][] = [];
for (let i = 0; i <= 10; i++) pts.push([A[0] + (B[0] - A[0]) * i / 10, A[1]]);
for (let i = 1; i <= 5; i++) pts.push([B[0], B[1] + (C[1] - B[1]) * i / 5]);
const man = (kind: Maneuver['kind'], begin: number, text: string): Maneuver =>
  ({ kind, begin, text, speak: text, distance_m: 0, time_s: 0, street: '' });
const route = buildRoute({
  shape: encode(pts), distance_m: 1500, time_s: 300,
  maneuvers: [man('depart', 0, 'Siga para o norte.'), man('right', 10, 'Vire à direita na Rua B.'), man('arrive', 15, 'Você chegou.')],
});

test('decodifica a linha do Valhalla', () => {
  const back = decodePolyline6(encode(pts));
  assert.equal(back.length, pts.length);
  assert.ok(Math.abs(back[3].lat - pts[3][0]) < 1e-6 && Math.abs(back[3].lon - pts[3][1]) < 1e-6);
  assert.ok(Math.abs(route.total_m - 1500) < 15, `total ${route.total_m}`);
});

test('encaixa na rota e mede o quanto andou', () => {
  const s = snapToRoute(route, { lat: -23.4955, lon: -46.6001 });
  assert.ok(Math.abs(s.along - 500) < 10, `along ${s.along}`);
  assert.ok(s.off < 15);
});

function drive(stateIn: NavState, fixes: { lat: number; lon: number; heading?: number; speed?: number }[]) {
  let st = stateIn; let last = null as ReturnType<typeof navStep> | null;
  for (const f of fixes) { last = navStep(route, st, f); st = last.state; }
  return last!;
}

test('na rota: mostra a próxima manobra e fala com 400 m e na hora', () => {
  let u = navStep(route, initialNavState(), { lat: -23.4990, lon: -46.6000, heading: 0, speed: 10 });
  assert.equal(u.next?.maneuver.kind, 'right');
  assert.ok(Math.abs(u.next!.distance_m - 890) < 15);
  assert.equal(u.speak, null);
  assert.equal(u.needsReroute, false);

  u = navStep(route, u.state, { lat: -23.4945, lon: -46.6000, heading: 0, speed: 10 }); // ~390 m antes
  assert.equal(u.speak, 'Em 400 metros, vire à direita na Rua B.');
  const again = navStep(route, u.state, { lat: -23.4944, lon: -46.6000, heading: 0, speed: 10 });
  assert.equal(again.speak, null, 'não repete');

  u = navStep(route, again.state, { lat: -23.4915, lon: -46.6000, heading: 0, speed: 10 }); // ~55 m
  assert.equal(u.speak, 'Vire à direita na Rua B.');
  assert.ok(u.remaining_s < 300 && u.remaining_s > 0);
});

test('saiu da rota: recalcula depois de 2 leituras fora, ou na hora se for longe', () => {
  const on = navStep(route, initialNavState(), { lat: -23.4990, lon: -46.6000 });
  const off1 = navStep(route, on.state, { lat: -23.4985, lon: -46.6006 }); // ~60 m pro lado
  assert.equal(off1.needsReroute, false, 'uma leitura fora pode ser erro do GPS');
  const off2 = navStep(route, off1.state, { lat: -23.4984, lon: -46.6007 });
  assert.equal(off2.needsReroute, true);
  const far = navStep(route, initialNavState(), { lat: -23.4990, lon: -46.6030 }); // ~300 m
  assert.equal(far.needsReroute, true);
  const fuzzy = drive(initialNavState(), [
    { lat: -23.4990, lon: -46.6005 }, { lat: -23.4989, lon: -46.6005 }, // ~50 m mas GPS ruim
  ].map((f) => ({ ...f, accuracy: 50 })));
  assert.equal(fuzzy.needsReroute, false, 'GPS impreciso dá mais folga');
});

test('na contramão da rota por 3 leituras: recalcula', () => {
  const u = drive(initialNavState(), [
    { lat: -23.4970, lon: -46.6000, heading: 180, speed: 8 },
    { lat: -23.4975, lon: -46.6000, heading: 180, speed: 8 },
    { lat: -23.4980, lon: -46.6000, heading: 180, speed: 8 },
  ]);
  assert.equal(u.needsReroute, true);
  const parado = drive(initialNavState(), [1, 2, 3].map(() => ({ lat: -23.4970, lon: -46.6000, heading: 180, speed: 0 })));
  assert.equal(parado.needsReroute, false, 'parado não conta');
});

test('chegada', () => {
  const u = navStep(route, initialNavState(), { lat: C[0], lon: C[1] - 0.0001 });
  assert.equal(u.arrived, true);
  assert.equal(u.speak, 'Você chegou ao destino.');
  assert.equal(u.needsReroute, false);
});

test('obstáculos na rota e o próximo à frente', () => {
  const items = [
    { id: 'na-rota', lat: -23.4950, lon: -46.6000 },
    { id: 'longe', lat: -23.4950, lon: -46.6050 },
    { id: 'depois-da-curva', lat: -23.4910, lon: -46.5970 },
  ];
  const on = obstaclesOnRoute(route, items);
  assert.deepEqual(on.map((o) => o.item.id), ['na-rota', 'depois-da-curva']);
  const n = nextObstacle(on, 400);
  assert.equal(n?.item.id, 'na-rota');
  assert.ok(Math.abs(n!.distance_m - 155) < 15);
  assert.equal(nextObstacle(on, 400, 100), null);
});

test('textos de distância, tempo e erros', () => {
  assert.equal(formatDistance(45), '45 m');
  assert.equal(formatDistance(347), '350 m');
  assert.equal(formatDistance(1234), '1,2 km');
  assert.equal(spokenDistance(390), '400 metros');
  assert.equal(spokenDistance(1000), '1 quilômetro');
  assert.equal(spokenDistance(2550), '2,6 quilômetros');
  assert.equal(formatDuration(30), '1 min');
  assert.equal(formatDuration(3900), '1 h 5 min');
  assert.equal(formatArrival(new Date(2026, 0, 1, 14, 50), 900), '15:05');
  assert.match(routeErrorText('sem_caminho'), /caminho/);
  assert.ok(distM({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }) === 0);
});

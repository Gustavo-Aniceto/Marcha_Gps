// Rota de verdade do Valhalla (Rua Guarará -> Av. Paulista, em pt-BR), passando pelo mesmo
// caminho do app: resposta do Valhalla -> parseValhalla (serviço de rotas) -> buildRoute -> navStep.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseValhalla } from '../../../../workers/api/src/route.ts';
import { buildRoute, distM, initialNavState, navStep, type NavState } from '../nav.ts';

const body = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/valhalla-paulista.json', import.meta.url).href), 'utf8'));
const route = buildRoute(parseValhalla(body));

/** Pontos a cada ~10 m ao longo da rota, com a direção do trecho. */
function drive(from = 0, to = route.total_m) {
  const out: { lat: number; lon: number; heading: number }[] = [];
  for (let i = 1; i < route.coords.length; i++) {
    const a = route.coords[i - 1], b = route.coords[i];
    const seg = route.cum[i] - route.cum[i - 1];
    const steps = Math.max(1, Math.ceil(seg / 10));
    const heading = (Math.atan2((b.lon - a.lon) * Math.cos(a.lat * Math.PI / 180), b.lat - a.lat) * 180 / Math.PI + 360) % 360;
    for (let k = 0; k < steps; k++) {
      const along = route.cum[i - 1] + (seg * k) / steps;
      if (along < from || along > to) continue;
      const t = k / steps;
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, heading });
    }
  }
  const end = route.coords[route.coords.length - 1];
  if (to >= route.total_m) out.push({ ...end, heading: out[out.length - 1]?.heading ?? 0 });
  return out;
}

test('rota real: tamanho e manobras batem com o Valhalla', () => {
  assert.ok(Math.abs(route.total_m - 2086) < 60, `total ${route.total_m}`);
  assert.equal(route.maneuvers.length, 6);
  assert.equal(route.maneuvers[1].kind, 'left');
  assert.match(route.maneuvers[1].text, /Alameda Campinas/);
  assert.equal(route.maneuvers[5].kind, 'arrive');
  // começa perto do ponto pedido
  assert.ok(distM(route.coords[0], { lat: -23.5713, lon: -46.66 }) < 50);
});

test('rota real: seguindo certinho, fala cada curva uma vez, não recalcula e chega', () => {
  let st: NavState = initialNavState();
  const spoken: string[] = [];
  let arrived = false, rerouted = false;
  for (const p of drive()) {
    const u = navStep(route, st, { ...p, speed: 10, accuracy: 8 });
    st = u.state;
    if (u.speak) spoken.push(u.speak);
    if (u.needsReroute) rerouted = true;
    if (u.arrived) { arrived = true; break; }
  }
  assert.equal(rerouted, false);
  assert.equal(arrived, true);
  assert.ok(spoken.some((s) => /esquerda.*Campinas/i.test(s)), spoken.join(' | '));
  assert.ok(spoken.some((s) => /Paulista/.test(s)), spoken.join(' | '));
  assert.equal(spoken[spoken.length - 1], 'Você chegou ao destino.');
  assert.equal(new Set(spoken).size, spoken.length, 'nenhuma frase repetida');
});

test('rota real: saindo da rota numa rua paralela, pede recálculo', () => {
  let st: NavState = initialNavState();
  const pts = drive(0, 600);
  for (const p of pts) st = navStep(route, st, { ...p, speed: 10, accuracy: 8 }).state;
  // segue reto ~150 m para o lado (uns 0,0012° de longitude), fora da Alameda Campinas
  const last = pts[pts.length - 1];
  let asked = false;
  for (let k = 1; k <= 4 && !asked; k++) {
    const u = navStep(route, st, { lat: last.lat, lon: last.lon + 0.0004 * k, heading: 90, speed: 10, accuracy: 8 });
    st = u.state;
    asked = u.needsReroute;
  }
  assert.equal(asked, true);
});

test('rota real: na contramão da rota, pede recálculo', () => {
  let st: NavState = initialNavState();
  const pts = drive(300, 500);
  let asked = false;
  for (const p of pts) {
    const u = navStep(route, st, { ...p, heading: (p.heading + 180) % 360, speed: 10, accuracy: 8 });
    st = u.state;
    if (u.needsReroute) { asked = true; break; }
  }
  assert.equal(asked, true);
});

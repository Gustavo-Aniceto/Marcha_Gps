import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convoyAlert, convoyRows, fmtKm } from '../convoy.ts';
import { densify, tileOf, tilesAlongRoute } from '../offline.ts';

const dest = { lat: -23.43, lon: -46.48 };
const now = Date.parse('2026-11-26T22:00:00Z');
const at = (sAgo: number) => new Date(now - sAgo * 1000).toISOString();

test('comboio: junto, ficou pra trás, chegou e sem sinal', () => {
  const rows = convoyRows([
    { username: 'lider', lat: -23.44, lon: -46.49, updated_at: at(10) },
    { username: 'colado', lat: -23.445, lon: -46.495, updated_at: at(20) },
    { username: 'longe', lat: -23.48, lon: -46.53, updated_at: at(30) },
    { username: 'chegou', lat: -23.4301, lon: -46.4801, updated_at: at(5) },
    { username: 'sumiu', lat: -23.44, lon: -46.49, updated_at: at(400) },
    { username: 'semgps', lat: null, lon: null, updated_at: null },
  ], dest, now);
  const st = Object.fromEntries(rows.map((r) => [r.username, r.status]));
  assert.deepEqual(st, { lider: 'junto', colado: 'junto', longe: 'atras', chegou: 'chegou', sumiu: 'sem_sinal', semgps: 'sem_sinal' });
  assert.ok(rows.find((r) => r.username === 'longe')!.gap_m! > 1500);
  assert.match(convoyAlert(rows)!, /^@longe ficou pra trás \(\d+,\d km\)$/);
});

test('comboio: você atrás não vira aviso pra você mesmo', () => {
  const rows = convoyRows([
    { username: 'a', lat: -23.44, lon: -46.49, updated_at: at(1) },
    { username: 'eu', me: true, lat: -23.5, lon: -46.6, updated_at: at(1) },
  ], dest, now);
  assert.equal(rows[1].status, 'atras');
  assert.equal(convoyAlert(rows), null);
});

test('comboio: km em português', () => {
  assert.equal(fmtKm(2345), '2,3 km');
  assert.equal(fmtKm(844), '840 m');
});

test('offline: quadradinho certo (Guarulhos, zoom 14)', () => {
  assert.deepEqual(tileOf({ lat: -23.4628, lon: -46.5333 }, 14), [6074, 9290]);
  assert.deepEqual(tileOf({ lat: 0, lon: 0 }, 0), [0, 0]);
});

test('offline: reta comprida ganha pontos no meio', () => {
  const pts = densify([{ lat: -23.40, lon: -46.50 }, { lat: -23.50, lon: -46.50 }], 400);
  assert.ok(pts.length > 25);
  assert.deepEqual(pts[pts.length - 1], { lat: -23.50, lon: -46.50 });
});

test('offline: rota de ~15 km tem poucos quadradinhos, sem repetir, zoom aberto primeiro, com teto', () => {
  const route = [{ lat: -23.4628, lon: -46.5333 }, { lat: -23.5505, lon: -46.6333 }];
  const t = tilesAlongRoute(route);
  assert.ok(t.length > 20 && t.length < 200, `quadradinhos: ${t.length}`);
  assert.equal(new Set(t.map((x) => x.join('/'))).size, t.length);
  assert.equal(t[0][0], 10);
  assert.ok(t.every((x) => x[0] <= 14));
  assert.equal(tilesAlongRoute(route, [14], 3, 10).length, 10);
});

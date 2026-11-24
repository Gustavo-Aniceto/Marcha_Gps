import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateSpeedMs, isOverLimit, radarAhead, smoothKmh, toKmh } from '../speed.ts';

const base = { lat: -23.55, lon: -46.63 };
// ~0,0001° de latitude = 11,1 m
const north = (m: number) => ({ lat: base.lat + m / 111_195, lon: base.lon });

test('velocidade: usa a do GPS quando vem', () => {
  assert.equal(estimateSpeedMs(null, { ...base, t: 0, speed: 12.5, accuracy: 5 }), 12.5);
});

test('velocidade: sem a do GPS, calcula por distância/tempo', () => {
  const a = { ...base, t: 0, speed: null, accuracy: 5 };
  const b = { ...north(50), t: 5000, speed: null, accuracy: 5 };
  const v = estimateSpeedMs(a, b)!;
  assert.ok(Math.abs(v - 10) < 0.1, String(v)); // 50 m em 5 s = 10 m/s = 36 km/h
  assert.equal(toKmh(v), 36);
});

test('velocidade: parado com o ponto tremendo é zero; GPS ruim ou leitura velha não calcula', () => {
  const a = { ...base, t: 0, speed: null, accuracy: 10 };
  assert.equal(estimateSpeedMs(a, { ...north(4), t: 2000, speed: null, accuracy: 10 }), 0);
  assert.equal(estimateSpeedMs(a, { ...north(40), t: 2000, speed: null, accuracy: 80 }), null);
  assert.equal(estimateSpeedMs(a, { ...north(400), t: 60_000, speed: null, accuracy: 5 }), null);
});

test('velocidade: suaviza e zera rápido ao parar', () => {
  assert.equal(smoothKmh(null, 10), 36);
  assert.ok(Math.abs(smoothKmh(36, 20)! - (36 * 0.4 + 72 * 0.6)) < 1e-9);
  assert.equal(smoothKmh(50, 0.5), 0);
  assert.equal(smoothKmh(40, null), 40);
});

test('radar à frente: pega o mais perto na direção em que vou, com velocidade', () => {
  const radars = [
    { id: 'atras', kind: 'radar', speed_limit: 50, ...north(-100) },
    { id: 'frente', kind: 'radar', speed_limit: 60, ...north(200) },
    { id: 'longe', kind: 'radar', speed_limit: 40, ...north(350) },
    { id: 'sem', kind: 'radar', speed_limit: null, ...north(80) },
    { id: 'lomb', kind: 'lombada', speed_limit: null, ...north(50) },
  ];
  const r = radarAhead(radars, base, 0)!;
  assert.equal(r.radar.id, 'frente');
  assert.ok(Math.abs(r.dist - 200) < 1);
  // indo pro sul, o de trás vira o da frente
  assert.equal(radarAhead(radars, base, 180)!.radar.id, 'atras');
  // sem direção: só o que está bem perto
  assert.equal(radarAhead(radars, base, null)!.radar.id, 'atras');
  assert.equal(radarAhead(radars, base, 90), null);
});

test('acima do limite', () => {
  assert.equal(isOverLimit(61, 60), true);
  assert.equal(isOverLimit(60.4, 60), false);
  assert.equal(isOverLimit(null, 60), false);
  assert.equal(isOverLimit(80, null), false);
});

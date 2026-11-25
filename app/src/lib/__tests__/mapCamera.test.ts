import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraFor } from '../mapCamera.ts';

test('2D deixa o mapa reto', () => {
  assert.equal(cameraFor({ theme: 'noite', threeD: false, pitch: 70, radiusM: 110 }).pitch, 0);
});
test('ângulo fica entre 20 e 88', () => {
  assert.equal(cameraFor({ theme: 'noite', threeD: true, pitch: 5, radiusM: 110 }).pitch, 20);
  assert.equal(cameraFor({ theme: 'noite', threeD: true, pitch: 99, radiusM: 110 }).pitch, 88);
});
test('raio maior afasta a câmera', () => {
  const perto = cameraFor({ theme: 'noite', threeD: true, pitch: 60, radiusM: 40 }).zoom;
  const longe = cameraFor({ theme: 'noite', threeD: true, pitch: 60, radiusM: 220 }).zoom;
  assert.equal(perto, 18.5);
  assert.ok(longe < perto && longe > 15);
});

import { gpsQuality, navZoom, resolveTheme, sunTimes } from '../mapCamera.ts';

test('sol em São Paulo no fim de novembro: nasce ~5h10 e se põe ~18h40 (horário de Brasília)', () => {
  const t = sunTimes(new Date('2026-11-25T15:00:00Z'))!;
  const local = (d: Date) => (d.getUTCHours() - 3) * 60 + d.getUTCMinutes();
  assert.ok(Math.abs(local(t.sunrise) - (5 * 60 + 10)) <= 10, `nasce ${t.sunrise.toISOString()}`);
  assert.ok(Math.abs(local(t.sunset) - (18 * 60 + 40)) <= 10, `põe ${t.sunset.toISOString()}`);
});

test('tema automático: dia de tarde, noite de madrugada; escolha manual manda', () => {
  assert.equal(resolveTheme('auto', new Date('2026-11-25T17:00:00Z')), 'dia');   // 14h
  assert.equal(resolveTheme('auto', new Date('2026-11-26T02:00:00Z')), 'noite'); // 23h
  assert.equal(resolveTheme('auto', new Date('2026-06-21T09:30:00Z')), 'noite'); // 6h30 no inverno, ainda escuro
  assert.equal(resolveTheme('noite', new Date('2026-11-25T17:00:00Z')), 'noite');
  assert.equal(resolveTheme('dia', new Date('2026-11-26T02:00:00Z')), 'dia');
});

test('zoom da navegação: afasta com a velocidade, aproxima perto da conversão', () => {
  assert.equal(navZoom(17, 20, null), 17);
  assert.equal(navZoom(17, 90, null), 15.4);
  assert.equal(navZoom(17, 140, null), 15.4, 'para de afastar');
  assert.ok(navZoom(17, 57, null) < 17 && navZoom(17, 57, null) > 15.4);
  assert.equal(navZoom(17, 30, 80), 17.4, 'devagar chegando na conversão');
  assert.equal(navZoom(17, 80, 80), navZoom(17, 80, null), 'rápido não aproxima');
  assert.equal(navZoom(17, null, null), 17);
});

test('sinal do GPS', () => {
  assert.equal(gpsQuality(10, 1000), 'bom');
  assert.equal(gpsQuality(120, 1000), 'fraco');
  assert.equal(gpsQuality(10, 20_000), 'perdido');
  assert.equal(gpsQuality(null, 1000), 'bom');
});

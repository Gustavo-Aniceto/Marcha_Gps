import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaPoints, cellId, MAX_POINTS } from '../areas.ts';

test('mesmo id do banco (area_cell) e do servidor', () => {
  assert.equal(cellId({ lat: -8.05, lon: -34.90 }), 'g409_725');
  assert.equal(cellId({ lat: -23.55, lon: -46.63 }), 'g332_666');
});

test('rota longa: um ponto por quadrado, sem repetir e no máximo 40', () => {
  // São Paulo -> Recife em linha reta (~2.100 km)
  const pts = areaPoints([{ lat: -23.55, lon: -46.63 }, { lat: -8.05, lon: -34.90 }]);
  assert.ok(pts.length === MAX_POINTS);
  assert.equal(new Set(pts.map(cellId)).size, pts.length);
  assert.equal(cellId(pts[0]), 'g332_666');
});

test('rota curta na cidade: 1 ou 2 quadrados; quadrado já marcado é pulado', () => {
  const route = [{ lat: -23.55, lon: -46.63 }, { lat: -23.56, lon: -46.65 }];
  const pts = areaPoints(route);
  assert.ok(pts.length >= 1 && pts.length <= 2);
  assert.equal(areaPoints(route, new Set(pts.map(cellId))).length, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineM } from '../geo.ts';

test('8 m de diferença de latitude', () => {
  const d = haversineM(-23.55, -46.63, -23.55007, -46.63);
  assert.ok(d > 7 && d < 9, String(d));
});
test('Sé até o aeroporto de Guarulhos ~ 20 km', () => {
  const d = haversineM(-23.5505, -46.6333, -23.4356, -46.4731);
  assert.ok(d > 19000 && d < 22000, String(d));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODIES } from '../carBodies.ts';
import { PROFILES, archSpan, clearance, profileFor, silhouette, wheelRadius, wheelZ } from '../car3dShape.ts';

test('3D: todo tipo de carroceria tem medidas coerentes', () => {
  for (const b of BODIES) {
    const p = PROFILES[b.id];
    assert.ok(p, `falta ${b.id}`);
    const h = p.L / 2;
    assert.ok(p.roofY > p.cowlY && p.roofY > p.tailY, `${b.id}: teto acima do capô/traseira`);
    assert.ok(p.roofFrontX > p.roofRearX && p.cowlX > p.roofFrontX, `${b.id}: ordem do teto e para-brisa`);
    assert.ok(p.frontAxle < h && p.rearAxle > -h, `${b.id}: eixos dentro do carro`);
    assert.ok(p.L / 2 <= 2.85, `${b.id}: cabe no quadro`);
    for (const [x, y] of silhouette(p)) assert.ok(Math.abs(x) <= h + 1e-9 && y >= 0 && y <= p.roofY + 1e-9, `${b.id}: ponto fora`);
  }
  assert.equal(profileFor('qualquer'), PROFILES.hatch);
});

test('3D: rodas, vão e arcos', () => {
  assert.ok(wheelRadius(17) > wheelRadius(14));
  assert.equal(wheelRadius(99), wheelRadius(22));
  const p = PROFILES.hatch;
  assert.ok(clearance(p, 5) < clearance(p, 15));
  assert.equal(clearance(p, 0), 0.05);
  assert.ok(wheelZ(p, 'fora') > wheelZ(p, 'alinhada') && wheelZ(p, 'dentro') < wheelZ(p, 'alinhada'));
  const span = archSpan(1.2, 0.2, 0.36);
  assert.ok(span && span[0] > 1.2 && span[1] < 1.2);
  assert.equal(archSpan(1.2, 0.5, 0.36), null);
});

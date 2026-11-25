import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODIES, CAR_COLORS, bodySpec, isLight, shade } from '../carBodies.ts';

test('carrocerias: ids únicos e tudo cabe no desenho (-32..32)', () => {
  assert.equal(new Set(BODIES.map((b) => b.id)).size, BODIES.length);
  for (const b of BODIES) {
    assert.ok(b.w + 3 < 32 && b.l < 32, b.id);
    assert.ok(b.shield[0] < b.shield[1] && b.roof[0] < b.roof[1], b.id);
    assert.ok(b.shield[0] > -b.l && b.roof[1] < b.l, `${b.id}: vidro/teto dentro da carroceria`);
    if (b.rear) assert.ok(b.rear[1] < b.l, b.id);
    if (b.bed) assert.ok(b.bed[0] > b.roof[1] && b.bed[1] < b.l, `${b.id}: caçamba atrás da cabine`);
  }
});

test('carroceria desconhecida vira hatch', () => {
  assert.equal(bodySpec('foguete').id, 'hatch');
  assert.equal(bodySpec(null).id, 'hatch');
  assert.equal(bodySpec('picape').id, 'picape');
});

test('cores: hex válido e nomes únicos', () => {
  for (const [hex] of CAR_COLORS) assert.match(hex, /^#[0-9A-F]{6}$/);
  assert.equal(new Set(CAR_COLORS.map(([, n]) => n)).size, CAR_COLORS.length);
});

test('shade clareia e escurece', () => {
  assert.equal(shade('#000000', 0.5), '#808080');
  assert.equal(shade('#FFFFFF', -0.5), '#808080');
  assert.equal(shade('#D23B3B', 0), '#D23B3B');
  assert.equal(shade('xpto', 0.3), 'xpto');
  assert.equal(isLight('#EDEFF2'), true);
  assert.equal(isLight('#2A2D34'), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resizeTarget } from '../photoSize.ts';

test('foto grande deitada reduz pelo lado maior', () => {
  assert.deepEqual(resizeTarget(4032, 3024), { width: 1600, height: 1200 });
});
test('foto em pé reduz pela altura', () => {
  assert.deepEqual(resizeTarget(3024, 4032), { width: 1200, height: 1600 });
});
test('foto pequena não aumenta', () => {
  assert.equal(resizeTarget(1200, 900), null);
  assert.equal(resizeTarget(1600, 1600), null);
});
test('tamanho inválido não mexe', () => {
  assert.equal(resizeTarget(0, 100), null);
  assert.equal(resizeTarget(NaN, 100), null);
});

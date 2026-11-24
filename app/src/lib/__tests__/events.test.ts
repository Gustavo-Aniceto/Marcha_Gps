import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventWindow, startFrom, whenText } from '../events.ts';

const at = (s: string) => new Date(s);

test('mídia abre 30 min antes e fecha no fim', () => {
  const ini = at('2026-11-28T21:00:00'), fim = at('2026-11-29T01:00:00');
  assert.equal(eventWindow(ini, fim, at('2026-11-28T20:00:00')), 'antes');
  assert.equal(eventWindow(ini, fim, at('2026-11-28T20:31:00')), 'aberto');
  assert.equal(eventWindow(ini, fim, at('2026-11-29T00:59:00')), 'aberto');
  assert.equal(eventWindow(ini, fim, at('2026-11-29T01:01:00')), 'acabou');
});

test('escolha de dia vira data', () => {
  const terca = at('2026-11-24T10:00:00'); // terça
  assert.equal(startFrom('hoje', 21, terca).toISOString(), at('2026-11-24T21:00:00').toISOString());
  assert.equal(startFrom('amanha', 20, terca).getDate(), 25);
  assert.equal(startFrom('sabado', 21, terca).getDate(), 28);
  assert.equal(startFrom('domingo', 15, terca).getDate(), 29);
});

test('texto do horário', () => {
  const now = at('2026-11-24T10:00:00');
  assert.equal(whenText(at('2026-11-24T21:00:00'), now), 'hoje, 21:00');
  assert.equal(whenText(at('2026-11-28T21:30:00'), now), 'sáb, 28/11 · 21:30');
});

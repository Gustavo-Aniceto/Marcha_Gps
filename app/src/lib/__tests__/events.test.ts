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

import { atTime, isPastDay, monthGrid, sameDay, shiftMonth } from '../events.ts';

test('calendário: novembro de 2026 começa num domingo e tem 30 dias', () => {
  const g = monthGrid(2026, 10);
  assert.equal(g[0][0]!.getDate(), 1, 'dia 1 é domingo');
  const days = g.flat().filter(Boolean);
  assert.equal(days.length, 30);
  assert.ok(g.every((w) => w.length === 7));
});

test('calendário: dezembro de 2026 começa numa terça (2 casinhas vazias antes)', () => {
  const g = monthGrid(2026, 11);
  assert.equal(g[0][0], null); assert.equal(g[0][1], null);
  assert.equal(g[0][2]!.getDate(), 1);
});

test('dia que já passou não pode ser escolhido; hoje pode', () => {
  const now = new Date(2026, 10, 25, 14, 0);
  assert.equal(isPastDay(new Date(2026, 10, 24), now), true);
  assert.equal(isPastDay(new Date(2026, 10, 25), now), false);
  assert.equal(isPastDay(new Date(2026, 10, 26), now), false);
});

test('junta dia + hora + minuto', () => {
  const d = atTime(new Date(2026, 11, 5), 21, 30);
  assert.equal(d.getHours(), 21); assert.equal(d.getMinutes(), 30); assert.equal(d.getDate(), 5);
  assert.ok(sameDay(d, new Date(2026, 11, 5, 8)));
});

test('troca de mês vira o ano', () => {
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
});

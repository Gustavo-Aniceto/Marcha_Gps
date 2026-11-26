import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FILTER, activeCount, filterCars, filterReports, groupOf, normalizeFilter } from '../mapFilter.ts';
import { REPORT_KINDS } from '../reports.ts';

test('todo tipo de aviso cai em algum grupo do filtro', () => {
  for (const k of REPORT_KINDS) assert.ok(groupOf(k.kind), k.kind);
});

test('filtra avisos por grupo e por confirmado', () => {
  const list = [
    { id: 1, kind: 'radar', status: 'confirmed' }, { id: 2, kind: 'lombada', status: 'unconfirmed' },
    { id: 3, kind: 'blitz', status: 'confirmed' }, { id: 4, kind: 'valeta', status: 'confirmed' },
  ];
  assert.equal(filterReports(list, DEFAULT_FILTER).length, 4);
  const f = normalizeFilter({ groups: { radar: false } });
  assert.deepEqual(filterReports(list, f).map((r) => r.id), [2, 3, 4]);
  assert.deepEqual(filterReports(list, { ...f, onlyConfirmed: true }).map((r) => r.id), [3, 4]);
});

test('carros: todos, só equipe, nenhum', () => {
  const cars = [{ same_crew: true }, { same_crew: false }];
  assert.equal(filterCars(cars, DEFAULT_FILTER).length, 2);
  assert.equal(filterCars(cars, { ...DEFAULT_FILTER, cars: 'equipe' }).length, 1);
  assert.equal(filterCars(cars, { ...DEFAULT_FILTER, cars: 'nenhum' }).length, 0);
});

test('o que veio salvo estragado volta pro padrão', () => {
  assert.deepEqual(normalizeFilter(null), DEFAULT_FILTER);
  assert.deepEqual(normalizeFilter({ cars: 'xx', groups: { radar: 'nao' }, onlyConfirmed: 1 }), DEFAULT_FILTER);
  assert.equal(activeCount(normalizeFilter({ cars: 'equipe', groups: { blitz: false }, onlyConfirmed: true })), 3);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFitment, clearanceFor, tireFor } from '../fitment.ts';

const base = { rim: 17, rideHeightCm: 8, wheelPosition: 'alinhada', camberDeg: 1.5, suspension: 'fixa' } as const;

test('setup comum passa', () => {
  assert.deepEqual(checkFitment(base), { ok: true, warnings: [] });
});

test('aro 19 em carro baixo pega no para-lama', () => {
  const r = checkFitment({ ...base, rim: 19 });
  assert.equal(r.ok, false);
  assert.match(r.warnings[0], /para-lama/);
});

test('roda pra fora em carro alto não avisa', () => {
  assert.ok(checkFitment({ ...base, wheelPosition: 'fora', rideHeightCm: 11 }).ok);
  assert.ok(!checkFitment({ ...base, wheelPosition: 'fora' }).ok);
});

test('pneu sugerido', () => {
  assert.equal(tireFor(17), '205/40 R17');
  assert.equal(tireFor(30), null);
});

test('lombada alta: raspa em carro de 11 cm, não passa em 5 cm', () => {
  assert.equal(clearanceFor(11, 3), 'raspa');
  assert.equal(clearanceFor(5, 3), 'nao_passa');
  assert.equal(clearanceFor(15, 2), 'passa');
});

test('suspensão a ar vira "raspa" (sobe antes)', () => {
  assert.equal(clearanceFor(5, 3, [], 'ar'), 'raspa');
});

test('voto de carro parecido manda mais que o risco base', () => {
  const votes = [
    { clearance: 'passa', rideHeightCm: 8 },
    { clearance: 'passa', rideHeightCm: 9 },
    { clearance: 'nao_passa', rideHeightCm: 15 },
  ] as const;
  assert.equal(clearanceFor(8, 3, [...votes]), 'passa');
});

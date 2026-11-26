import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGate, toPayload } from '../errorReport.ts';

test('monta o erro e ignora o que não é nosso', () => {
  const p = toPayload(new TypeError('x is undefined'), '/post/123?a=1', 'v9')!;
  assert.equal(p.message, 'TypeError: x is undefined');
  assert.equal(p.screen, '/post/123');
  assert.equal(p.version, 'v9');
  assert.ok(p.stack);
  assert.equal(toPayload(new Error('ResizeObserver loop limit exceeded'), null, 'v'), null);
  assert.equal(toPayload(new TypeError('Failed to fetch'), null, 'v'), null);
  assert.equal(toPayload('Script error.', null, 'v'), null);
  assert.equal(toPayload(undefined, null, 'v'), null);
  assert.equal(toPayload({ message: 'algo' }, null, 'v')!.message, 'algo');
});

test('não repete o mesmo erro e tem teto por sessão', () => {
  const gate = makeGate(3);
  const e = (m: string) => toPayload(new Error(m), '/x', 'v')!;
  assert.equal(gate(e('falhou 1')), true);
  assert.equal(gate(e('falhou 2')), false); // mesmo erro, só muda número
  assert.equal(gate(e('outro')), true);
  assert.equal(gate(e('mais um')), true);
  assert.equal(gate(e('e mais')), false);   // passou do teto
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pollPercents, pollProblem } from '../poll.ts';

test('porcentagem da enquete soma 100', () => {
  assert.deepEqual(pollPercents([{ votes: 1 }, { votes: 1 }, { votes: 1 }]), [34, 33, 33]);
  assert.deepEqual(pollPercents([{ votes: 3 }, { votes: 1 }]), [75, 25]);
  assert.deepEqual(pollPercents([{ votes: 0 }, { votes: 0 }]), [0, 0]);
  const p = pollPercents([{ votes: 2 }, { votes: 5 }, { votes: 7 }, { votes: 1 }]);
  assert.equal(p.reduce((s, v) => s + v, 0), 100);
});

test('conferência da enquete antes de mandar', () => {
  assert.equal(pollProblem('', ['a', 'b']), 'Escreve a pergunta da enquete.');
  assert.equal(pollProblem('Qual aro?', ['17', ' ']), 'Põe pelo menos 2 opções.');
  assert.equal(pollProblem('Qual aro?', ['17', '17']), 'Tem opção repetida.');
  assert.equal(pollProblem('Qual aro?', ['x'.repeat(61), 'b']), 'Cada opção pode ter até 60 letras.');
  assert.equal(pollProblem('Qual aro?', ['15', '', '17', '18']), null);
});

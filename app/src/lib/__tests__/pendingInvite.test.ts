import { test } from 'node:test';
import assert from 'node:assert/strict';

// só as partes puras (sem AsyncStorage)
const { formatInviteCode, inviteStatusText } = await import('../pendingInviteText.ts');

test('formata o código do convite enquanto digita', () => {
  assert.equal(formatInviteCode('7k2q'), '7K2Q');
  assert.equal(formatInviteCode('7k2qlf9a'), '7K2Q-LF9A');
  assert.equal(formatInviteCode('7K2Q-LF9A'), '7K2Q-LF9A');
  assert.equal(formatInviteCode(' 7k 2q-lf9a99 '), '7K2Q-LF9A');
  assert.equal(formatInviteCode('7k2ql'), '7K2Q-L');
});

test('mensagens do convite', () => {
  assert.match(inviteStatusText('usado'), /já foi usado/);
  assert.match(inviteStatusText('vencido'), /venceu/);
  assert.match(inviteStatusText('nao_existe'), /não encontrado/);
});

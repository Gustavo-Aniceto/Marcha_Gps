import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REASONS, canSend, reasonsFor } from '../moderation.ts';

test('motivos certos pra cada coisa denunciada', () => {
  assert.ok(reasonsFor('aviso').some((r) => r.value === 'falso'));
  assert.ok(!reasonsFor('aviso').some((r) => r.value === 'ofensivo'));
  assert.ok(!reasonsFor('post').some((r) => r.value === 'falso'));
  for (const t of ['post', 'comment', 'profile', 'aviso'] as const) assert.ok(reasonsFor(t).some((r) => r.value === 'outro'));
  // os mesmos valores que o banco aceita
  assert.deepEqual(REASONS.map((r) => r.value).sort(), ['falso', 'golpe', 'ofensivo', 'outro', 'perigoso', 'privacidade', 'spam']);
});

test('só envia com motivo; "outro" pede explicação', () => {
  assert.equal(canSend(null, ''), false);
  assert.equal(canSend('spam', ''), true);
  assert.equal(canSend('outro', 'oi'), false);
  assert.equal(canSend('outro', 'perfil fake de loja'), true);
  assert.equal(canSend('spam', 'x'.repeat(501)), false);
});

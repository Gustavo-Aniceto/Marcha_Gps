import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickClerkKey } from '../clerkKey.ts';

test('domínio próprio usa o modo produção; o resto, o de teste', () => {
  assert.equal(pickClerkKey('marchagps.eu.org', 'pk_test_x', 'pk_live_y'), 'pk_live_y');
  assert.equal(pickClerkKey('WWW.marchagps.eu.org', 'pk_test_x', 'pk_live_y'), 'pk_live_y');
  assert.equal(pickClerkKey('marcha-gps.vercel.app', 'pk_test_x', 'pk_live_y'), 'pk_test_x');
  assert.equal(pickClerkKey(null, 'pk_test_x', 'pk_live_y'), 'pk_test_x', 'app nativo: teste até virar a chave');
  assert.equal(pickClerkKey('marchagps.eu.org', 'pk_test_x', undefined), 'pk_test_x', 'sem chave de produção configurada');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_ORIGIN, authBaseUrl, authErrorText, EMAIL_RE } from '../authUrl.ts';

test('login sempre pelo próprio site (/api/auth), pra o Safari não bloquear o cookie', () => {
  assert.equal(authBaseUrl('https://marcha-gps.vercel.app'), 'https://marcha-gps.vercel.app/api/auth');
  assert.equal(authBaseUrl('https://marchagps.eu.org/'), 'https://marchagps.eu.org/api/auth');
  assert.equal(authBaseUrl(null), `${APP_ORIGIN}/api/auth`, 'app nativo: usa o site');
  assert.equal(authBaseUrl('file://x'), `${APP_ORIGIN}/api/auth`);
  assert.equal(authBaseUrl('http://localhost:8081', 'https://x.dev/auth/'), 'https://x.dev/auth', 'dá pra trocar no .env');
});

test('erros do login em português', () => {
  assert.match(authErrorText({ code: 'INVALID_OTP' }), /Código errado/);
  assert.match(authErrorText({ error: { code: 'TOO_MANY_ATTEMPTS' } }), /Muitas tentativas/);
  assert.match(authErrorText({ status: 429 }), /Muitas tentativas/);
  assert.match(authErrorText(new TypeError('Failed to fetch')), /Sem conexão/);
  assert.match(authErrorText(null), /Tenta de novo/);
  assert.ok(EMAIL_RE.test('fulano@gmail.com') && !EMAIL_RE.test('fulano@') && !EMAIL_RE.test('a b@c.com'));
});

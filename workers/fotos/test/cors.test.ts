import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preflight, withCors } from '../src/cors.ts';

test('preflight libera o envio do navegador com token', () => {
  const r = preflight();
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.match(r.headers.get('access-control-allow-headers') ?? '', /authorization/);
  assert.match(r.headers.get('access-control-allow-methods') ?? '', /POST/);
});

test('resposta normal ganha os cabeçalhos sem perder status nem corpo', async () => {
  const r = withCors(new Response('{"key":"x"}', { status: 201, headers: { 'content-type': 'application/json' } }));
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('content-type'), 'application/json');
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal(await r.text(), '{"key":"x"}');
});

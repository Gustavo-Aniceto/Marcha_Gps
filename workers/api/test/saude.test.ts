import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanError, healthChecks } from '../src/saude.ts';
import { authSources } from '../../fotos/src/jwt.ts';

test('saude: checagens incluem o login (Neon Auth) e o Clerk enquanto durar a troca', () => {
  const c = healthChecks(authSources('https://great-aphid-3258.clerk.accounts.dev,https://ep-x.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth'), 'https://photon/x');
  const names = c.map((x) => x.service);
  assert.deepEqual(names.slice(-2), ['login_clerk', 'login']);
  assert.equal(c.at(-1)!.url, 'https://ep-x.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth/.well-known/jwks.json');
  assert.ok(names.includes('dados') && names.includes('rotas') && names.includes('busca'));
  const dados = c.find((x) => x.service === 'dados')!;
  assert.equal(dados.ok(401), true);   // sem token: está no ar
  assert.equal(dados.ok(503), false);
});

test('saude: limpa o erro que o app manda', () => {
  assert.equal(cleanError(null), null);
  assert.equal(cleanError({ message: '   ' }), null);
  const e = cleanError({
    message: 'falhou com eyJabcdefghijklmn.eyJzdWIiOiJ1c2VyIn0.assinatura pra fulano@gmail.com',
    stack: 'x'.repeat(5000), screen: '/post/123?token=abc&b=1', version: 'v1',
  })!;
  assert.equal(e.message, 'falhou com [token] pra [email]');
  assert.equal(e.stack!.length, 4000);
  assert.equal(e.screen, '/post/123');
  assert.equal(e.version, 'v1');
});

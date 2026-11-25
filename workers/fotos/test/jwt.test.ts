import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issuerList, verifyFromIssuers, verifyJwt, type Jwk } from '../src/jwt.ts';
import { extFor, keyFor, KEY_RE, looksLikeImage } from '../src/uploads.ts';

const ISS = 'https://exemplo.clerk.accounts.dev';
const b64url = (b: Uint8Array | string) =>
  Buffer.from(typeof b === 'string' ? b : b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function keys() {
  const kp = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']);
  const pub = (await crypto.subtle.exportKey('jwk', kp.publicKey)) as Jwk;
  pub.kid = 'k1';
  return { priv: kp.privateKey, jwks: [pub] };
}

async function sign(priv: CryptoKey, claims: object, header: object = { alg: 'RS256', kid: 'k1', typ: 'JWT' }) {
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(claims));
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', priv, new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(sig)}`;
}

const now = 1_800_000_000;
const good = { sub: 'user_2abcDEF', iss: ISS, exp: now + 60, nbf: now - 5, role: 'authenticated' };

test('token válido do Clerk passa', async () => {
  const { priv, jwks } = await keys();
  const c = await verifyJwt(await sign(priv, good), jwks, { issuer: ISS, now });
  assert.equal(c.sub, 'user_2abcDEF');
});

test('token vencido, de outro emissor ou com assinatura trocada é recusado', async () => {
  const { priv, jwks } = await keys();
  await assert.rejects(verifyJwt(await sign(priv, { ...good, exp: now - 120 }), jwks, { issuer: ISS, now }), /token_vencido/);
  await assert.rejects(verifyJwt(await sign(priv, { ...good, iss: 'https://outro.dev' }), jwks, { issuer: ISS, now }), /emissor_invalido/);
  const outro = await keys();
  await assert.rejects(verifyJwt(await sign(outro.priv, good), jwks, { issuer: ISS, now }), /assinatura_invalida|chave_desconhecida/);
  const t = await sign(priv, good);
  const [h, , s] = t.split('.');
  const forjado = `${h}.${b64url(JSON.stringify({ ...good, sub: 'user_outra_pessoa' }))}.${s}`;
  await assert.rejects(verifyJwt(forjado, jwks, { issuer: ISS, now }), /assinatura_invalida/);
});

test('alg none e lixo são recusados', async () => {
  const { jwks } = await keys();
  const none = `${b64url(JSON.stringify({ alg: 'none' }))}.${b64url(JSON.stringify(good))}.`;
  await assert.rejects(verifyJwt(none, jwks, { issuer: ISS, now }), /algoritmo_invalido/);
  await assert.rejects(verifyJwt('abc', jwks, { issuer: ISS, now }), /token_malformado/);
});

test('sub com caracteres estranhos é recusado (vira parte da chave do arquivo)', async () => {
  const { priv, jwks } = await keys();
  await assert.rejects(verifyJwt(await sign(priv, { ...good, sub: '../../etc' }), jwks, { issuer: ISS, now }), /usuario_invalido/);
});

test('regras de arquivo', () => {
  assert.equal(extFor('image/jpeg'), 'jpg');
  assert.equal(extFor('image/gif'), null);
  assert.ok(looksLikeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'jpg'));
  assert.ok(!looksLikeImage(new TextEncoder().encode('<html>'), 'jpg'));
  const k = keyFor('media', 'user_2abc', '0b6a1c1e-1111-4a4a-9c9c-123456789abc', 'jpg');
  assert.match(k, KEY_RE);
  // mesmo formato que o banco aceita (check_own_photo_key / posts.photo_key)
  assert.match(k, /^[a-z]+\/[A-Za-z0-9_-]+\/[0-9a-f-]{36}\.(jpg|png|webp)$/);
});

test('vários emissores: aceita teste e produção, cada um com a sua chave', async () => {
  const dev = await keys(), prod = await keys();
  const PROD = 'https://clerk.marchagps.eu.org';
  const list = issuerList(` ${ISS}, ${PROD}/ `);
  assert.deepEqual(list, [ISS, PROD]);
  const jwksOf = async (iss: string) => (iss === ISS ? dev.jwks : prod.jwks);
  const t1 = await sign(dev.priv, good);
  const t2 = await sign(prod.priv, { ...good, iss: PROD });
  assert.equal((await verifyFromIssuers(t1, list, jwksOf, { now })).iss, ISS);
  assert.equal((await verifyFromIssuers(t2, list, jwksOf, { now })).iss, PROD);
});

test('vários emissores: emissor fora da lista é recusado antes de baixar chave', async () => {
  const dev = await keys();
  let fetched = false;
  const t = await sign(dev.priv, { ...good, iss: 'https://mau.example' });
  await assert.rejects(verifyFromIssuers(t, [ISS], async () => { fetched = true; return dev.jwks; }, { now }), /emissor_invalido/);
  assert.equal(fetched, false);
});

test('vários emissores: token de um emissor assinado com a chave de outro não passa', async () => {
  const dev = await keys(), prod = await keys();
  const PROD = 'https://clerk.marchagps.eu.org';
  const forged = await sign(dev.priv, { ...good, iss: PROD });
  await assert.rejects(verifyFromIssuers(forged, [ISS, PROD], async (i) => (i === ISS ? dev.jwks : prod.jwks), { now }), /assinatura_invalida|chave_desconhecida/);
});

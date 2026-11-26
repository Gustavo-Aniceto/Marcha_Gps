import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedEndpoint, b64uDecode, b64uEncode, encryptPayload, pushPayload, vapidAuthorization, vapidPublicKey, type VapidJwk } from '../src/webpush.ts';

const enc = new TextEncoder();

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

test('webpush: o aparelho consegue abrir o conteúdo (RFC 8291)', async () => {
  // "aparelho": par de chaves + segredo
  const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey) as ArrayBuffer);
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  const msg = JSON.stringify({ title: 'Comboio saindo', body: 'Toque pra entrar', link: '/comboio/1' });

  const out = await encryptPayload(enc.encode(msg), b64uEncode(uaPublic), b64uEncode(authSecret));
  // cabeçalho
  const salt = out.slice(0, 16);
  assert.equal(new DataView(out.buffer).getUint32(16), 4096);
  assert.equal(out[20], 65);
  const asPublic = out.slice(21, 86);
  const ct = out.slice(86);
  // decifra como o navegador faria
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(authSecret, shared, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
  assert.equal(plain[plain.length - 1], 2);
  assert.equal(new TextDecoder().decode(plain.slice(0, -1)), msg);
});

test('webpush: inscrição com chave errada é recusada', async () => {
  await assert.rejects(encryptPayload(enc.encode('x'), b64uEncode(new Uint8Array(10)), b64uEncode(new Uint8Array(16))), /inscricao_invalida/);
});

test('webpush: VAPID assinado confere com a chave pública', async () => {
  const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', kp.privateKey)) as unknown as VapidJwk;
  const h = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', jwk, 'https://marcha-gps.vercel.app', 1_000_000);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h)!;
  assert.ok(m);
  const claims = JSON.parse(new TextDecoder().decode(b64uDecode(m[2])));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.exp, 1_000_000 + 12 * 3600);
  assert.equal(m[4], vapidPublicKey(jwk));
  assert.equal(b64uDecode(m[4]).length, 65);
  const pub = await crypto.subtle.importKey('raw', b64uDecode(m[4]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64uDecode(m[3]), enc.encode(`${m[1]}.${m[2]}`));
  assert.equal(ok, true);
});

test('webpush: só serviços de push conhecidos; link interno', () => {
  assert.equal(allowedEndpoint('https://fcm.googleapis.com/fcm/send/x'), true);
  assert.equal(allowedEndpoint('https://web.push.apple.com/abc'), true);
  assert.equal(allowedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'), true);
  assert.equal(allowedEndpoint('https://evil.example.com/x'), false);
  assert.equal(allowedEndpoint('http://fcm.googleapis.com/x'), false);
  assert.equal(pushPayload({ title: 'a', body: null, link: 'https://x.com' }).link, '/conta');
  assert.equal(pushPayload({ title: 'a', body: 'b', link: '/comboio/1' }).link, '/comboio/1');
});

// Web Push sem biblioteca (só WebCrypto, roda no Worker e no Node):
//   - criptografia do conteúdo (RFC 8291, "aes128gcm")
//   - assinatura VAPID (RFC 8292, JWT ES256)
// A chave privada VAPID fica no segredo VAPID_PRIVATE_JWK do Worker (JWK P-256 com x, y, d).

export interface PushTarget { endpoint: string; p256dh: string; auth: string }
export interface VapidJwk { kty: 'EC'; crv: 'P-256'; x: string; y: string; d: string }

const enc = new TextEncoder();

export function b64uDecode(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64uEncode(bytes: Uint8Array | ArrayBuffer): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const c of u) bin += String.fromCharCode(c);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

/** Chave pública VAPID (65 bytes, base64url) a partir da JWK: é ela que o app usa pra se inscrever. */
export function vapidPublicKey(jwk: VapidJwk): string {
  return b64uEncode(concat(new Uint8Array([4]), b64uDecode(jwk.x), b64uDecode(jwk.y)));
}

/** Conteúdo criptografado pro aparelho (corpo do POST no endpoint). */
export async function encryptPayload(plaintext: Uint8Array, p256dh: string, auth: string,
                                     salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16))): Promise<Uint8Array> {
  const uaPublic = b64uDecode(p256dh);
  const authSecret = b64uDecode(auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('inscricao_invalida');
  const as = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ct);
}

/** Cabeçalho Authorization VAPID pro serviço de push do endpoint. */
export async function vapidAuthorization(endpoint: string, jwk: VapidJwk, subject: string,
                                         now = Math.floor(Date.now() / 1000)): Promise<string> {
  const aud = new URL(endpoint).origin;
  const head = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64uEncode(enc.encode(JSON.stringify({ aud, exp: now + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64uEncode(sig)}, k=${vapidPublicKey(jwk)}`;
}

/** Monta o pedido de envio (o Worker só faz fetch). */
export async function pushRequest(target: PushTarget, payload: unknown, jwk: VapidJwk, subject: string): Promise<Request> {
  const body = await encryptPayload(enc.encode(JSON.stringify(payload)), target.p256dh, target.auth);
  return new Request(target.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapidAuthorization(target.endpoint, jwk, subject),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: '86400',
      urgency: 'normal',
    },
    body,
  });
}

/** Só manda pra serviços de push conhecidos (evita usar o Worker pra chamar endereço qualquer). */
export function allowedEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:') return false;
    return /(^|\.)(fcm\.googleapis\.com|googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/.test(u.hostname);
  } catch { return false; }
}

/** Texto da notificação no celular (curto; link interno do app). */
export function pushPayload(row: { title: string; body: string | null; link: string | null }): { title: string; body: string; link: string } {
  const link = row.link && /^\/[A-Za-z0-9/_\-\[\]\.]*$/.test(row.link) ? row.link : '/conta';
  return { title: row.title.slice(0, 120), body: (row.body ?? '').slice(0, 240), link };
}

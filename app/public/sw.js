// Service worker do Marcha GPS (site instalável):
//  - notificações com o app fechado (Web Push): mostra e, no toque, abre a tela certa
//  - app abre sem internet: guarda a casca do app e os arquivos (nomes com hash)
//  - mapa sem internet: guarda os quadradinhos do OpenFreeMap que passaram pela tela e os da rota
//    (o app manda a lista quando calcula a rota)
//  - avisos do Radar: guarda a última resposta pra mostrar sem sinal
// Não toca em login (Clerk), fotos nem nas chamadas que gravam.
const V = 'v1';
const SHELL = `marcha-casca-${V}`;
const STATIC = `marcha-arquivos-${V}`;
const MAP = `marcha-mapa-${V}`;
const DATA = `marcha-dados-${V}`;
const MAX_MAP = 4000;
const MAX_STATIC = 300;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.json', '/icon-192.png'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, STATIC, MAP, DATA]);
    for (const k of await caches.keys()) if (k.startsWith('marcha-') && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

// ---------- notificações ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Marcha GPS', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Marcha GPS', {
    body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', lang: 'pt-BR',
    data: { link: typeof d.link === 'string' && d.link.startsWith('/') ? d.link : '/conta' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '/conta';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        c.postMessage({ type: 'abrir', link });
        return;
      }
    }
    await self.clients.openWindow(link);
  })());
});

// ---------- guardar pra usar sem internet ----------
let puts = 0;
async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
async function put(name, req, res, max) {
  if (!res || !res.ok) return;
  const c = await caches.open(name);
  await c.put(req, res);
  if (++puts % 50 === 0) trim(name, max);
}

async function cacheFirst(name, req, max) {
  const hit = await caches.match(req, { cacheName: name });
  if (hit) return hit;
  const res = await fetch(req);
  put(name, req, res.clone(), max);
  return res;
}

async function networkFirst(name, req, timeoutMs, max) {
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('lento')), timeoutMs))]);
    put(name, req, res.clone(), max);
    return res;
  } catch (err) {
    const hit = await caches.match(req, { cacheName: name, ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // páginas do app: tenta a rede; sem internet abre a casca guardada
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith(networkFirst(SHELL, req, 4000, 50).catch(async () =>
      (await caches.match('/', { cacheName: SHELL })) || Response.error()));
    return;
  }
  // arquivos do app (nomes com hash) e modelos 3D
  if (url.origin === self.location.origin && /^\/(_expo\/static|assets|models)\//.test(url.pathname)) {
    e.respondWith(cacheFirst(STATIC, req, MAX_STATIC));
    return;
  }
  // mapa (OpenFreeMap): quadradinhos e letras guardados; o índice (planet) tenta a rede antes
  if (url.hostname === 'tiles.openfreemap.org') {
    e.respondWith(/\.(pbf|mvt|png|webp)$/.test(url.pathname)
      ? cacheFirst(MAP, req, MAX_MAP)
      : networkFirst(MAP, req, 5000, MAX_MAP));
    return;
  }
  // avisos do Radar (leitura): última resposta guardada vale sem sinal
  if (/neon\.tech$/.test(url.hostname) && /\/reports$/.test(url.pathname)) {
    e.respondWith(networkFirst(DATA, req, 6000, 200));
  }
});

// O app manda os quadradinhos da rota: baixa e guarda (6 por vez), sem repetir o que já tem.
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type !== 'guardar-rota' || !Array.isArray(d.tiles)) return;
  e.waitUntil((async () => {
    let template = null;
    try {
      const res = await networkFirst(MAP, new Request('https://tiles.openfreemap.org/planet'), 6000, MAX_MAP);
      template = (await res.json()).tiles[0];
    } catch { return; }
    const c = await caches.open(MAP);
    const list = d.tiles.slice(0, 600);
    let i = 0;
    const worker = async () => {
      while (i < list.length) {
        const [z, x, y] = list[i++];
        const u = template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        if (await c.match(u)) continue;
        try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch { /* sem sinal: para */ return; }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    trim(MAP, MAX_MAP);
  })());
});

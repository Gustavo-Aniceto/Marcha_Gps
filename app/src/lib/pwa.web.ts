// Site instalável: service worker (public/sw.js), notificações com o app fechado (Web Push)
// e guardar o mapa da rota pra usar sem internet. No app nativo: pwa.ts (não faz nada por enquanto).
import { db } from './db';
import { tilesAlongRoute, type LatLon } from './offline.ts';

const base = process.env.EXPO_PUBLIC_API_URL;

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'on' | 'off';

let reg: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registra o service worker uma vez. `onOpen`: notificação tocada com o app aberto (abre a tela). */
export function registerServiceWorker(onOpen?: (link: string) => void): void {
  if (reg || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (location.hostname === 'localhost' && !location.search.includes('sw=1')) { reg = Promise.resolve(null); return; }
  reg = navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => null);
  navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data as { type?: string; link?: string } | null;
    if (d?.type === 'abrir' && typeof d.link === 'string' && d.link.startsWith('/')) onOpen?.(d.link);
  });
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function installed(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  if (!('PushManager' in window) || !('Notification' in window)) return isIOS() && !installed() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const r = await (reg ?? navigator.serviceWorker.getRegistration());
  const sub = await r?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function keyBytes(b64u: string): ArrayBuffer {
  const s = atob(b64u.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64u.length + 3) % 4));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

/** Liga as notificações neste aparelho (precisa ser chamado num toque). */
export async function enablePush(): Promise<PushState> {
  if (!base) throw new Error('push_nao_configurado');
  registerServiceWorker();
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const r = (await reg) ?? (await navigator.serviceWorker.ready);
  const res = await fetch(`${base}/push/chave`);
  if (!res.ok) throw new Error('push_nao_configurado');
  const { chave } = (await res.json()) as { chave: string };
  let sub = await r.pushManager.getSubscription();
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(chave) });
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await db.rpc('save_push_subscription', {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw new Error(error.message);
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const r = await (reg ?? navigator.serviceWorker.getRegistration());
  const sub = await r?.pushManager.getSubscription();
  if (sub) {
    await db.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe().catch(() => {});
  }
  return 'off';
}

/** Pede pro service worker baixar o mapa em volta da rota (pra seguir guiando sem sinal). */
export async function saveRouteForOffline(coords: LatLon[]): Promise<void> {
  try {
    const r = await (reg ?? navigator.serviceWorker?.getRegistration());
    const sw = r?.active ?? navigator.serviceWorker?.controller;
    if (!sw || coords.length < 2) return;
    sw.postMessage({ type: 'guardar-rota', tiles: tilesAlongRoute(coords) });
  } catch { /* sem service worker: segue normal */ }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

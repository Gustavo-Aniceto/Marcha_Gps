// App nativo: notificação push e mapa offline ainda não (no navegador: pwa.web.ts).
import type { LatLon } from './offline.ts';

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'on' | 'off';

export function registerServiceWorker(_onOpen?: (link: string) => void): void {}
export async function pushState(): Promise<PushState> { return 'unsupported'; }
export async function enablePush(): Promise<PushState> { return 'unsupported'; }
export async function disablePush(): Promise<PushState> { return 'unsupported'; }
export async function saveRouteForOffline(_coords: LatLon[]): Promise<void> {}
export function isOnline(): boolean { return true; }

// Liga a captura de erros: erros soltos do navegador/celular e os que derrubam uma tela (ErrorBoundary).
import { authToken } from './db';
import { makeGate, toPayload } from './errorReport.ts';

const base = process.env.EXPO_PUBLIC_API_URL;
// versão = commit publicado na Vercel (ou "dev")
export const APP_VERSION = (process.env.EXPO_PUBLIC_APP_VERSION || 'dev').slice(0, 12);
const gate = makeGate(10);
let currentScreen: string | null = null;

export function setErrorScreen(path: string | null) { currentScreen = path; }

export async function reportError(err: unknown, screen: string | null = currentScreen) {
  try {
    if (!base) return;
    const p = toPayload(err, screen, APP_VERSION);
    if (!p || !gate(p)) return;
    const token = await authToken().catch(() => null);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    await fetch(`${base}/erro`, { method: 'POST', headers, body: JSON.stringify(p), keepalive: true });
  } catch { /* nunca quebra o app por causa disso */ }
}

let installed = false;
export function installErrorReporting() {
  if (installed) return;
  installed = true;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('error', (e) => reportError(e.error ?? e.message));
    window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
  }
  // celular (React Native): pega o que ia derrubar o app e repassa pro tratamento normal
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void;
                                                       setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  if (g.ErrorUtils) {
    const prev = g.ErrorUtils.getGlobalHandler();
    g.ErrorUtils.setGlobalHandler((e, fatal) => { reportError(e); prev(e, fatal); });
  }
}

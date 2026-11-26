// Manda pro nosso servidor (POST /erro do marcha-gps-api) os erros que acontecem no app.
// O Adm Master vê em Conta > Moderação > Saúde do app. Nada de dado pessoal: o servidor ainda limpa
// token e e-mail que às vezes aparecem em mensagem de erro.

export interface ErrorPayload { message: string; stack: string | null; screen: string | null; version: string }

/** Erros que não são nossos (extensão do navegador, aba fechando, rede caindo) não vale mandar. */
const IGNORE = [
  /ResizeObserver loop/i,
  /^Script error\.?\s*$/im,           // erro de script de outro site (sem detalhe nenhum)
  /chrome-extension:|moz-extension:|safari-extension:/i,
  /AbortError|The user aborted a request/i,
  /Failed to fetch|Network request failed|NetworkError|Load failed/i,
];

export function toPayload(err: unknown, screen: string | null, version: string): ErrorPayload | null {
  let message = '', stack: string | null = null;
  if (err instanceof Error) { message = `${err.name}: ${err.message}`; stack = err.stack ?? null; }
  else if (typeof err === 'string') message = err;
  else if (err && typeof err === 'object' && 'message' in err) message = String((err as { message: unknown }).message);
  else message = String(err);
  message = message.trim();
  if (!message || message === 'undefined' || message === 'null') return null;
  const all = `${message}\n${stack ?? ''}`;
  if (IGNORE.some((r) => r.test(all))) return null;
  return { message: message.slice(0, 500), stack: stack ? stack.slice(0, 4000) : null, screen: screen ? screen.split('?')[0].slice(0, 200) : null, version };
}

/** Não repete o mesmo erro na mesma sessão e manda no máximo `max` por sessão. */
export function makeGate(max = 10) {
  const seen = new Set<string>();
  let sent = 0;
  return (p: ErrorPayload): boolean => {
    const key = `${p.message.replace(/[0-9]+/g, '#')}|${p.screen ?? ''}`;
    if (seen.has(key) || sent >= max) return false;
    seen.add(key); sent++;
    return true;
  };
}

// Regras do que pode ser enviado e onde guardar.
export const KINDS = ['media', 'carro', 'post'] as const;
export type Kind = (typeof KINDS)[number];

export const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function extFor(contentType: string | null): string | null {
  if (!contentType) return null;
  return EXT[contentType.split(';')[0].trim().toLowerCase()] ?? null;
}

/** Confere a assinatura do arquivo, pra ninguém mandar outra coisa fingindo ser imagem. */
export function looksLikeImage(bytes: Uint8Array, ext: string): boolean {
  const at = (i: number) => bytes[i];
  if (ext === 'jpg') return at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff;
  if (ext === 'png') return at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47;
  if (ext === 'webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

/** Mesmo formato que o banco aceita: <tipo>/<user_id>/<uuid>.<ext> */
export function keyFor(kind: Kind, userId: string, uuid: string, ext: string): string {
  return `${kind}/${userId}/${uuid}.${ext}`;
}

export const KEY_RE = /^(media|carro|post)\/[A-Za-z0-9_-]{1,128}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

// Tamanho das fotos antes do envio: lado maior até 1600 px, JPEG 70%.
// Fica em ~300-500 KB por foto, bem dentro da cota grátis do R2.
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.7;

/** Novo tamanho mantendo a proporção, ou null se a foto já é pequena (não aumenta). */
export function resizeTarget(width: number, height: number, max = MAX_SIDE): { width: number; height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  const side = Math.max(width, height);
  if (side <= max) return null;
  const k = max / side;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

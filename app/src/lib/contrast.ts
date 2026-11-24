// Tema da equipe: garante que a cor escolhida dá pra ler no fundo escuro do app.
import { colors } from '../theme/tokens.ts';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(color: string): boolean {
  return HEX.test(color);
}

function channels(hex: string): [number, number, number] {
  if (!isHex(hex)) throw new Error(`cor inválida: ${hex}`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mixWithWhite(hex: string, amount: number): string {
  return '#' + channels(hex)
    .map((v) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** Cor usada em textos, ícones e contornos. Se a cor da equipe for escura demais, clareia até dar 4.5:1. */
export function readableAccent(color: string, background: string = colors.bg): string {
  if (contrastRatio(color, background) >= 4.5) return color.toUpperCase();
  for (let k = 0.1; k <= 1.0001; k += 0.05) {
    const c = mixWithWhite(color, k);
    if (contrastRatio(c, background) >= 4.5) return c;
  }
  return '#FFFFFF';
}

/** Cor do texto em cima de um botão preenchido com a cor da equipe. */
export function inkOn(color: string): string {
  return contrastRatio(color, colors.ink) >= contrastRatio(color, '#FFFFFF') ? colors.ink : '#FFFFFF';
}

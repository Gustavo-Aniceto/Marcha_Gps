// Copiar/compartilhar texto (convite etc.). No celular abre o menu de compartilhar; no navegador
// usa o compartilhar do sistema se tiver, senão copia.
import { Platform, Share } from 'react-native';

export async function copyText(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && navigator.clipboard) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* sem permissão de copiar */ }
  return false;
}

export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
      if (nav.share) { await nav.share({ text }); return 'shared'; }
      return (await copyText(text)) ? 'copied' : 'failed';
    }
    await Share.share({ message: text });
    return 'shared';
  } catch {
    return (await copyText(text)) ? 'copied' : 'failed';
  }
}

export const APP_URL = 'https://marcha-gps.vercel.app';

/** Link do convite: abre com a prévia (WhatsApp mostra) e já entra com o código preenchido. */
export function inviteLink(code: string): string {
  return `${APP_URL}/c/${code}`;
}

export function inviteMessage(code: string, kind: 'founder' | 'app'): string {
  if (kind === 'founder') {
    return `Bora pro Marcha GPS! Seu código de fundador pra registrar sua equipe: ${code}\nToque pra entrar: ${inviteLink(code)}\nVale uma vez só.`;
  }
  return `Bora pro Marcha GPS! Seu convite: ${code}\nToque pra entrar: ${inviteLink(code)}\nVale 7 dias. Lá dentro você pede pra entrar na sua equipe.`;
}

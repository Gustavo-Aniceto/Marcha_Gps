// Convite digitado antes do login: fica guardado no aparelho até a pessoa entrar
// (no navegador sobrevive ao vai-e-volta do login com Google/Apple/Facebook).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'marcha.convite.pendente';

export interface PendingInvite { code: string; kind: 'fundador' | 'equipe'; crewName: string | null }

export async function savePendingInvite(i: PendingInvite) {
  await AsyncStorage.setItem(KEY, JSON.stringify(i));
}

export async function loadPendingInvite(): Promise<PendingInvite | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? (JSON.parse(v) as PendingInvite) : null;
  } catch {
    return null;
  }
}

export async function clearPendingInvite() {
  await AsyncStorage.removeItem(KEY);
}

export { formatInviteCode, inviteStatusText } from './pendingInviteText.ts';

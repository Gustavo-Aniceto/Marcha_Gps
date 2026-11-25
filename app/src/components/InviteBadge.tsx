// Mostra o convite já conferido na tela de login ("Convite ok · Equipe X").
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { clearPendingInvite, loadPendingInvite, type PendingInvite } from '../lib/pendingInvite';
import { colors, fonts } from '../theme/tokens.ts';

export function InviteBadge() {
  const router = useRouter();
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  useEffect(() => { loadPendingInvite().then(setInvite); }, []);

  if (!invite) {
    return (
      <Pressable onPress={() => router.replace('/(auth)/inicio')} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: colors.holo, fontSize: 14 }}>Ainda não tem conta? Comece pelo seu convite</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ borderWidth: 1, borderColor: colors.neon, borderRadius: 6, padding: 12, gap: 4, backgroundColor: colors.panel }}>
      <Text style={{ color: colors.neon, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1 }}>CONVITE OK · {invite.code}</Text>
      <Text style={{ color: colors.text, fontSize: 14 }}>
        {invite.kind === 'fundador' ? 'Convite pra registrar sua equipe.' : 'Convite pro app. Depois você pede pra entrar nas equipes.'}
        {' '}Agora entre com a conta que preferir.
      </Text>
      <Pressable onPress={async () => { await clearPendingInvite(); router.replace('/(auth)/inicio'); }} accessibilityRole="button">
        <Text style={{ color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>Trocar convite</Text>
      </Pressable>
    </View>
  );
}

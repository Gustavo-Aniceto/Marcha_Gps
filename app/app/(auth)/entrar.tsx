// Login: tela nativa do Clerk (Google, Apple, Facebook ou código no e-mail). Vem depois do convite.
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ClerkNative from '@clerk/expo/native-components';

// os tipos publicados do Clerk não descrevem as props do AuthView
const AuthView = (ClerkNative as unknown as Record<string, unknown>).AuthView as as React.ComponentType<Record<string, unknown>>;
import { colors, fonts } from '../../src/theme/tokens.ts';
import { InviteBadge } from '../../src/components/InviteBadge';

export default function Entrar() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 6 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 36, color: colors.neon, letterSpacing: 1.5 }}>
          MARCHA <Text style={{ color: colors.text }}>GPS</Text>
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>O GPS da cena rebaixada. Aqui só entra quem é convidado.</Text>
        <InviteBadge />
      </View>
      {/* Depois do login, o Gate do _layout leva pro convite ou pro mapa */}
      <View style={{ flex: 1 }}>
        <AuthView mode="signInOrUp" isDismissible={false} />
      </View>
    </SafeAreaView>
  );
}

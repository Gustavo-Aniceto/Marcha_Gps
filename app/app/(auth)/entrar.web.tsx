// Login no navegador: componente web do Clerk (código no e-mail, igual ao app).
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SignIn } from '@clerk/expo/web';
import { colors, fonts } from '../../src/theme/tokens.ts';
import { InviteBadge } from '../../src/components/InviteBadge';

export default function Entrar() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}
                contentContainerStyle={{ padding: 20, paddingTop: 48, gap: 20, alignItems: 'center' }}>
      <View style={{ gap: 6, width: '100%', maxWidth: 420 }}>
        <Text style={{ fontFamily: fonts.brand, fontSize: 36, color: colors.neon, letterSpacing: 1.5 }}>
          MARCHA <Text style={{ color: colors.text }}>GPS</Text>
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>O GPS da cena rebaixada. Aqui só entra quem é convidado.</Text>
      </View>
      <View style={{ width: '100%', maxWidth: 420 }}><InviteBadge /></View>
      {/* Depois do login, o Gate do _layout leva pro convite ou pro mapa */}
      <SignIn
        routing="hash"
        withSignUp
        appearance={{
          variables: {
            colorPrimary: colors.neon,
            colorBackground: '#0B111C',
            borderRadius: '6px',
            colorForeground: colors.text,
            colorMutedForeground: colors.textMuted,
            colorPrimaryForeground: colors.bg,
            colorInput: colors.bg,
            colorInputForeground: colors.text,
            colorNeutral: colors.text,
            colorShimmer: 'transparent',
          },
        }}
      />
    </ScrollView>
  );
}

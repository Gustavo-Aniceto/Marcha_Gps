// Página de texto legal (termos / privacidade). Abre com ou sem login.
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Screen, Title } from './ui';
import { CONTACT_EMAIL, LEGAL_UPDATED, type LegalSection } from '../lib/legal';
import { colors } from '../theme/tokens.ts';

export function LegalPage({ title, sections, other }: { title: string; sections: LegalSection[]; other: { label: string; href: '/termos' | '/privacidade' } }) {
  const router = useRouter();
  return (
    <Screen>
      <Title back sub={`Atualizado em ${LEGAL_UPDATED}`}>{title}</Title>
      {sections.map((s) => (
        <Card key={s.title} style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }} accessibilityRole="header">{s.title}</Text>
          {s.items.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: colors.neon, lineHeight: 21 }}>•</Text>
              <Text style={{ color: colors.textDim, fontSize: 14, lineHeight: 21, flex: 1 }}>{t}</Text>
            </View>
          ))}
        </Card>
      ))}
      <Card style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>Contato</Text>
        {CONTACT_EMAIL ? (
          <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} accessibilityRole="link" style={{ minHeight: 40, justifyContent: 'center' }}>
            <Text style={{ color: colors.holo, fontWeight: '700' }}>{CONTACT_EMAIL}</Text>
          </Pressable>
        ) : (
          <Text style={{ color: colors.textDim, lineHeight: 21 }}>
            Fale com o fundador da sua equipe, que passa pro Adm Master. Se ainda não tem equipe, use quem te convidou. Logo teremos um e-mail aqui.
          </Text>
        )}
      </Card>
      <Pressable onPress={() => router.push(other.href as never)} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'center' }}>
        <Text style={{ color: colors.holo, fontWeight: '700' }}>{other.label} ›</Text>
      </Pressable>
    </Screen>
  );
}

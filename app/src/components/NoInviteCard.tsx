// Aviso pra quem tenta entrar sem convite (primeira tela e escolha do nome).
import React from 'react';
import { Text, View } from 'react-native';
import { Card } from './ui';
import { IconBadge } from './Icon';
import { NO_INVITE } from '../lib/pendingInviteText.ts';
import { colors, fonts } from '../theme/tokens.ts';

export function NoInviteCard() {
  return (
    <Card accent={colors.lineStrong} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <IconBadge name="lock" size={40} color={colors.holo} />
      <View style={{ flex: 1, gap: 4 }} accessibilityRole="alert">
        <Text style={{ color: colors.text, fontFamily: fonts.display, fontWeight: '800', fontSize: 16 }}>{NO_INVITE.title}</Text>
        <Text style={{ color: colors.textDim, fontSize: 14, lineHeight: 20 }}>{NO_INVITE.text}</Text>
      </View>
    </Card>
  );
}

// Placa de velocidade máxima, igual à da rua (fundo branco, aro vermelho).
import React from 'react';
import { Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens.ts';

export function SpeedSign({ limit, size = 40 }: { limit: number; size?: number }) {
  return (
    <View accessibilityLabel={`Velocidade máxima ${limit} km/h`} accessibilityRole="image"
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.signFace,
                   borderWidth: Math.max(3, size * 0.12), borderColor: colors.signRing,
                   alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: size * (limit >= 100 ? 0.34 : 0.42),
                     lineHeight: size * 0.5, includeFontPadding: false }}>{limit}</Text>
    </View>
  );
}

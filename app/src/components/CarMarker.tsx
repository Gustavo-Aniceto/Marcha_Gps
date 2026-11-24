// Carrinho visto de cima, na cor e com o neon que a pessoa montou na garagem.
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Ellipse, Rect } from 'react-native-svg';
import { colors, fonts } from '../theme/tokens.ts';

const NEON: Record<string, string> = { verde: '#C6FF3D', azul: '#3FA0FF', roxo: '#B36BFF' };

export function CarMarker({
  color = '#B9C0CB', neon, heading, label, sameCrew, approximate, me,
}: {
  color?: string; neon?: string | null; heading?: number | null; label?: string;
  sameCrew?: boolean; approximate?: boolean; me?: boolean;
}) {
  const glow = neon ? NEON[neon] : undefined;
  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel={label ? `Carro de ${label}` : 'Seu carro'}>
      {label ? (
        <Text style={{
          fontFamily: fonts.mono, fontSize: 10, color: sameCrew ? colors.neon : colors.holo,
          backgroundColor: 'rgba(6,12,22,0.88)', borderWidth: 1, borderColor: sameCrew ? colors.neon : colors.lineStrong,
          paddingHorizontal: 5, paddingVertical: 1, marginBottom: 2,
        }}>{label}</Text>
      ) : null}
      <Svg width={44} height={44} viewBox="-22 -22 44 44">
        {approximate && <Ellipse rx={21} ry={21} fill={color} fillOpacity={0.12} stroke={color} strokeOpacity={0.4} strokeDasharray="2 3" />}
        <Rect x={-7} y={-13} width={14} height={26} rx={5} fill={color} stroke={me ? colors.target : '#FFFFFF'}
              strokeWidth={me ? 2 : 1} transform={`rotate(${heading ?? 0})`} />
        {glow && <Ellipse rx={10} ry={16} fill={glow} fillOpacity={0.3} transform={`rotate(${heading ?? 0})`} />}
        <Rect x={-5} y={-6} width={10} height={10} rx={2} fill="#04060A" fillOpacity={0.8} transform={`rotate(${heading ?? 0})`} />
      </Svg>
    </View>
  );
}

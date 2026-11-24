// Carrinho visto de cima, na cor e com o neon que a pessoa montou na garagem.
// O seu carro ganha a mira amarela em volta (fácil de achar no mapa).
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from '../theme/tokens.ts';

const NEON: Record<string, string> = { verde: '#C6FF3D', azul: '#3FA0FF', roxo: '#B36BFF' };

export function CarMarker({
  color = '#B9C0CB', neon, heading, label, sameCrew, approximate, me,
}: {
  color?: string; neon?: string | null; heading?: number | null; label?: string;
  sameCrew?: boolean; approximate?: boolean; me?: boolean;
}) {
  const glow = neon ? NEON[neon] : me ? colors.holo : undefined;
  const rot = `rotate(${heading ?? 0})`;
  const size = me ? 64 : 52;
  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel={label ? `Carro de ${label}` : 'Seu carro'}>
      {label ? (
        <Text style={{
          fontFamily: fonts.mono, fontSize: 10, color: sameCrew ? colors.neon : colors.holo,
          backgroundColor: 'rgba(6,12,22,0.88)', borderWidth: 1, borderColor: sameCrew ? colors.neon : colors.lineStrong,
          paddingHorizontal: 5, paddingVertical: 1, marginBottom: 2,
        }}>{label}</Text>
      ) : null}
      <Svg width={size} height={size} viewBox="-32 -32 64 64">
        <Defs>
          <RadialGradient id="neon" cx="0" cy="0" r="1" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor={glow ?? color} stopOpacity={0.55} />
            <Stop offset="1" stopColor={glow ?? color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {approximate && <Circle r={30} fill={color} fillOpacity={0.1} stroke={color} strokeOpacity={0.45} strokeDasharray="3 4" />}
        {me && <Circle r={29} fill="none" stroke={colors.target} strokeWidth={2} strokeOpacity={0.9} strokeDasharray="10 6" />}
        {/* neon embaixo do carro */}
        {glow && <Ellipse rx={15} ry={22} fill="url(#neon)" transform={rot} />}
        {/* rodas */}
        <Rect x={-11} y={-12} width={4} height={7} rx={1.5} fill="#0A0C10" transform={rot} />
        <Rect x={7} y={-12} width={4} height={7} rx={1.5} fill="#0A0C10" transform={rot} />
        <Rect x={-11} y={6} width={4} height={7} rx={1.5} fill="#0A0C10" transform={rot} />
        <Rect x={7} y={6} width={4} height={7} rx={1.5} fill="#0A0C10" transform={rot} />
        {/* carroceria (frente pra cima) */}
        <Path d="M-8 -16 Q0 -20 8 -16 L9 12 Q0 17 -9 12 Z" fill={color}
              stroke={me ? colors.target : '#FFFFFF'} strokeOpacity={me ? 1 : 0.7} strokeWidth={me ? 1.6 : 1} transform={rot} />
        {/* para-brisa, teto e vidro de trás */}
        <Path d="M-6.5 -9 Q0 -12 6.5 -9 L5.5 -4 L-5.5 -4 Z" fill="#05080E" fillOpacity={0.85} transform={rot} />
        <Rect x={-5.5} y={-3.5} width={11} height={9} rx={2} fill={color} stroke="#05080E" strokeOpacity={0.35} transform={rot} />
        <Path d="M-5.5 6 L5.5 6 L6 9 Q0 11 -6 9 Z" fill="#05080E" fillOpacity={0.8} transform={rot} />
        {/* faróis */}
        <Circle cx={-5} cy={-16.5} r={1.4} fill="#FFF6D6" transform={rot} />
        <Circle cx={5} cy={-16.5} r={1.4} fill="#FFF6D6" transform={rot} />
        {/* lanternas */}
        <Rect x={-7} y={12.5} width={3.5} height={1.4} rx={0.6} fill="#FF3B3B" transform={rot} />
        <Rect x={3.5} y={12.5} width={3.5} height={1.4} rx={0.6} fill="#FF3B3B" transform={rot} />
      </Svg>
    </View>
  );
}

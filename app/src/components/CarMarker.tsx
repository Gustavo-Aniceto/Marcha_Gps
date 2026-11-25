// Carrinho visto de cima: carroceria, cor, vidro, aerofólio e neon que a pessoa montou na garagem.
// O seu carro ganha um halo azul em volta (fácil de achar no mapa).
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { carParts, type Part } from '../lib/carDrawing.ts';
import { colors, fonts } from '../theme/tokens.ts';

const NEON: Record<string, string> = { verde: '#C6FF3D', azul: '#3FA0FF', roxo: '#B36BFF' };

function PartEl({ p }: { p: Part }) {
  const common = { fill: 'fill' in p ? p.fill : undefined, opacity: p.opacity, stroke: 'stroke' in p ? p.stroke : undefined,
                   strokeWidth: 'sw' in p ? p.sw : undefined };
  switch (p.t) {
    case 'rect': return <Rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} {...common} />;
    case 'ellipse': return <Ellipse cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} {...common} />;
    case 'path': return <Path d={p.d} {...common} />;
    case 'line': return <Line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.sw} opacity={p.opacity} strokeLinecap="round" />;
  }
}

export function CarMarker({
  color = '#B9C0CB', neon, heading, label, sameCrew, approximate, me, body, tint, spoiler, size: sizeProp,
}: {
  color?: string; neon?: string | null; heading?: number | null; label?: string;
  sameCrew?: boolean; approximate?: boolean; me?: boolean;
  body?: string | null; tint?: string | null; spoiler?: boolean | null; size?: number;
}) {
  const glow = neon ? NEON[neon] : undefined;
  const size = sizeProp ?? (me ? 80 : 58);
  const parts = React.useMemo(() => carParts({ body, color, tint, spoiler }), [body, color, tint, spoiler]);
  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel={me ? 'Seu carro' : label ? `Carro de ${label}` : 'Carro'}>
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
            <Stop offset="0" stopColor={glow ?? color} stopOpacity={0.6} />
            <Stop offset="1" stopColor={glow ?? color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {approximate && <Circle r={30} fill={color} fillOpacity={0.1} stroke={color} strokeOpacity={0.45} strokeDasharray="3 4" />}
        {me && <Circle r={30} fill={colors.holo} fillOpacity={0.12} stroke={colors.holo} strokeWidth={1.5} strokeOpacity={0.8} />}
        <G transform={`rotate(${heading ?? 0})`}>
          {/* neon embaixo do carro */}
          {glow && <Ellipse rx={17} ry={26} fill="url(#neon)" />}
          {parts.map((p, i) => <PartEl key={i} p={p} />)}
        </G>
      </Svg>
    </View>
  );
}

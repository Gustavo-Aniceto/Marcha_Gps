// Ícone de cada aviso do Radar no mapa (no lugar da etiqueta com texto).
// Avisos de segurança ficam sempre laranja, seja qual for o tema da equipe.
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens.ts';
import { kindInfo, type ReportKind } from '../lib/reports.ts';
import { glyphFor } from '../lib/reportGlyphs.ts';
import { SpeedSign } from './SpeedSign';

const INK = colors.ink;

/** Desenho de cada tipo, num quadro de 24x24, em traço escuro sobre o laranja (dados em lib/reportGlyphs). */
function Glyph({ kind }: { kind: ReportKind }) {
  const p = { stroke: INK, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (<>
    {glyphFor(kind).map((g, i) => g.t === 'path'
      ? <Path key={i} d={g.d} {...p} fill={g.fill ? INK : 'none'} fillOpacity={g.fill ? 0.85 : undefined} />
      : g.t === 'rect'
        ? <Rect key={i} x={g.x} y={g.y} width={g.w} height={g.h} rx={g.rx} {...p} fill="none" />
        : <Circle key={i} cx={g.cx} cy={g.cy} r={g.r} {...(g.fill ? { fill: INK } : { ...p, fill: 'none' })} />)}
  </>);
}

export function ReportIcon({ kind, size = 30, unconfirmed, speedLimit }: {
  kind: ReportKind; size?: number; unconfirmed?: boolean; speedLimit?: number | null;
}) {
  const label = `${kindInfo(kind).label}${speedLimit ? ` ${speedLimit} km/h` : ''}${unconfirmed ? ', não confirmado' : ''}`;
  const icon = (
    <View accessibilityLabel={label} accessibilityRole="image"
          style={{
            width: size, height: size, borderRadius: size / 2, backgroundColor: colors.warn,
            borderWidth: 2, borderColor: '#1A1006', alignItems: 'center', justifyContent: 'center',
            opacity: unconfirmed ? 0.6 : 1,
            shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
          }}>
      <Svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24"><Glyph kind={kind} /></Svg>
    </View>
  );
  if (kind !== 'radar' || !speedLimit) return icon;
  // radar com velocidade: a placa com o limite fica colada no ícone
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {icon}
      <View style={{ marginLeft: -size * 0.18, opacity: unconfirmed ? 0.75 : 1 }}>
        <SpeedSign limit={speedLimit} size={Math.round(size * 0.85)} />
      </View>
    </View>
  );
}

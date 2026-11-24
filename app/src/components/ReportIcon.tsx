// Ícone de cada aviso do Radar no mapa (no lugar da etiqueta com texto).
// Avisos de segurança ficam sempre laranja, seja qual for o tema da equipe.
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens.ts';
import { kindInfo, type ReportKind } from '../lib/reports.ts';
import { SpeedSign } from './SpeedSign';

const INK = colors.ink;

/** Desenho de cada tipo, num quadro de 24x24, em traço escuro sobre o laranja. */
function Glyph({ kind }: { kind: ReportKind }) {
  const p = { fill: 'none', stroke: INK, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'radar': // câmera de radar no poste
      return (<>
        <Rect x={4} y={7} width={12} height={8} rx={1.5} {...p} />
        <Circle cx={10} cy={11} r={2.2} {...p} />
        <Path d="M16 9.5 20 8v6l-4-1.5M10 15v5M7 20h6" {...p} />
      </>);
    case 'lombada': // lombada: morrinho na pista
      return (<>
        <Path d="M2 17h4c1.5 0 2.5-6 6-6s4.5 6 6 6h4" {...p} />
        <Path d="M9 8.5 12 6l3 2.5" {...p} />
      </>);
    case 'valeta': // valeta: buraco em V na pista
      return (<>
        <Path d="M2 9h5c1.5 0 2.5 7 5 7s3.5-7 5-7h5" {...p} />
        <Path d="M9 19.5 12 22l3-2.5" {...p} />
      </>);
    case 'buraco':
      return (<>
        <Path d="M2 15h20" {...p} />
        <Path d="M7 15c0 3 2 4.5 5 4.5s5-1.5 5-4.5" {...p} fill={INK} fillOpacity={0.85} />
        <Path d="M9 11.5l1-2M14 9.5l1 2" {...p} />
      </>);
    case 'rua_ruim': // asfalto quebrado
      return (<>
        <Path d="M3 18h18M5 6h14" {...p} />
        <Path d="M8 6l2 4-3 3 3 5M15 6l-1 3 3 4-2 5" {...p} />
      </>);
    case 'rampa': // rampa que raspa
      return (<>
        <Path d="M3 19h18L14 9H3z" {...p} />
        <Path d="M6 15h3" {...p} />
      </>);
    case 'blitz': // sirene
      return (<>
        <Path d="M7 18v-5a5 5 0 0 1 10 0v5" {...p} />
        <Path d="M5 18h14M12 3v2M4.5 6.5l1.5 1.5M19.5 6.5 18 8" {...p} />
      </>);
    case 'alagamento': // água na pista
      return (<>
        <Path d="M12 3s-4 4.5-4 7.5a4 4 0 0 0 8 0C16 7.5 12 3 12 3z" {...p} />
        <Path d="M3 18c2 0 2-1.5 4.5-1.5S10 18 12 18s2-1.5 4.5-1.5S19 18 21 18" {...p} />
      </>);
    case 'sonorizador': // faixas que tremem
      return (<>
        <Path d="M6 5v14M10 5v14M14 5v14M18 5v14" {...p} />
      </>);
    case 'faixa_elevada': // faixa de pedestre em cima de lombada
      return (<>
        <Path d="M2 18h4c1.5 0 2.5-5 6-5s4.5 5 6 5h4" {...p} />
        <Path d="M9 9v2M12 7v3M15 9v2" {...p} />
      </>);
    default:
      return <Circle cx={12} cy={12} r={3} fill={INK} />;
  }
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

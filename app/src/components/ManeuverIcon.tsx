// Seta da manobra (vire à direita, rotatória, chegada...).
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { ManeuverKind } from '../lib/nav.ts';
import { colors } from '../theme/tokens.ts';

// setas desenhadas apontando pra cima; as da esquerda são espelho das da direita
const PATHS: Partial<Record<ManeuverKind, string>> = {
  straight: 'M12 21V4M6 10l6-6 6 6',
  depart: 'M12 21V4M6 10l6-6 6 6',
  slight_right: 'M8 21v-7l8-9M10 5h6v6',
  right: 'M7 21V12a3 3 0 0 1 3-3h10M15 4l5 5-5 5',
  sharp_right: 'M7 3v9a3 3 0 0 0 3 3h9M14 20l5-5-5-5',
  uturn: 'M7 21V9a5 5 0 0 1 10 0v6M13 11l4 4 4-4',
  merge: 'M7 4l5 6v11M17 4l-5 6',
  ramp_right: 'M8 21v-7l8-9M10 5h6v6',
};

export function ManeuverIcon({ kind, size = 44, color = colors.ink }: { kind: ManeuverKind; size?: number; color?: string }) {
  if (kind === 'arrive') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z" /><Circle cx={12} cy={10} r={2.2} />
      </Svg>
    );
  }
  if (kind === 'roundabout') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={11} r={4} /><Path d="M12 21v-6M15 8l4-4M15 4h4v4" />
      </Svg>
    );
  }
  const mirror = kind === 'slight_left' || kind === 'left' || kind === 'sharp_left' || kind === 'ramp_left';
  const base = mirror ? (kind.replace('left', 'right') as ManeuverKind) : kind;
  const d = PATHS[base] ?? PATHS.straight!;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
         style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path d={d} />
    </Svg>
  );
}

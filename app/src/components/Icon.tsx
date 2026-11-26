// Ícones de linha fina (traço 1.8), no lugar dos emojis: dão o ar mais sóbrio dos painéis.
// Desenhos próprios no estilo dos ícones abertos de interface (24x24).
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens.ts';

export type IconName =
  | 'edit' | 'bell' | 'lock' | 'trophy' | 'map' | 'help' | 'camera' | 'chart' | 'logout' | 'user'
  | 'calendar' | 'pin' | 'clock' | 'flag' | 'users' | 'car' | 'filter' | 'search' | 'plus' | 'check' | 'chevron'
  | 'chat' | 'ticket' | 'heart' | 'heartFill' | 'share';

const P: Record<IconName, React.ReactNode> = {
  edit: <Path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />,
  bell: <><Path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z" /><Path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  lock: <><Rect x={5} y={10.5} width={14} height={10} rx={2.5} /><Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  trophy: <><Path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><Path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7" /></>,
  map: <><Path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2v-13z" /><Path d="M9 4.5v13M15 6.5v13" /></>,
  help: <><Circle cx={12} cy={12} r={8.5} /><Path d="M9.8 9.6a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.5v.4M12 16.6v.1" /></>,
  camera: <><Path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4v-10z" /><Circle cx={12} cy={13} r={3.3} /></>,
  chart: <Path d="M5 19V11M10 19V6M15 19v-5M20 19V9" />,
  logout: <><Path d="M14 4.5h4.5v15H14" /><Path d="M10 8l-4 4 4 4M6 12h9" /></>,
  user: <><Circle cx={12} cy={8.5} r={3.8} /><Path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  calendar: <><Rect x={4} y={5.5} width={16} height={14.5} rx={2.5} /><Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  pin: <><Path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 1 1 13 0c0 5-6.5 11-6.5 11z" /><Circle cx={12} cy={10} r={2.4} /></>,
  clock: <><Circle cx={12} cy={12} r={8.5} /><Path d="M12 7.5V12l3 2" /></>,
  flag: <Path d="M6 21V4.5M6 5h11l-2 3.5L17 12H6" />,
  users: <><Circle cx={9} cy={8.5} r={3.3} /><Path d="M3 19.5a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 6M18 19.5a6 6 0 0 0-3-5.2" /></>,
  car: <><Path d="M4 15.5v-3l2-5h12l2 5v3" /><Path d="M3.5 15.5h17v3h-17z" /><Circle cx={7.5} cy={18.5} r={1.4} /><Circle cx={16.5} cy={18.5} r={1.4} /></>,
  filter: <Path d="M4 6h16M7 12h10M10 18h4" />,
  search: <><Circle cx={11} cy={11} r={6.5} /><Path d="M16 16l4 4" /></>,
  plus: <Path d="M12 5v14M5 12h14" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <Path d="M9.5 6l6 6-6 6" />,
  chat: <Path d="M5 18.5V6.5h14v10H9l-4 2z" />,
  ticket: <><Path d="M4 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h16v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H4v2z" /><Path d="M14 6v12" /></>,
  heart: <Path d="M12 19.5S4.5 15 4.5 9.6A3.9 3.9 0 0 1 12 7.8a3.9 3.9 0 0 1 7.5 1.8C19.5 15 12 19.5 12 19.5z" />,
  heartFill: <Path d="M12 19.5S4.5 15 4.5 9.6A3.9 3.9 0 0 1 12 7.8a3.9 3.9 0 0 1 7.5 1.8C19.5 15 12 19.5 12 19.5z" fill="currentColor" />,
  share: <><Path d="M12 4v11M8 8l4-4 4 4" /><Path d="M5 13v6h14v-6" /></>,
};

export function Icon({ name, size = 20, color = colors.text, stroke = 1.8 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} color={color} strokeWidth={stroke}
         strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </Svg>
  );
}

/** Ícone dentro de um círculo discreto (linhas de menu, como nos painéis de referência). */
export function IconBadge({ name, size = 38, color = colors.textDim }: { name: IconName; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.panelAlt, borderWidth: 1,
                   borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.5} color={color} />
    </View>
  );
}

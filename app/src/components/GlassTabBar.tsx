// Barra de baixo flutuante, em pílula, com fundo de vidro (desfoca o que passa por trás).
// O item ativo ganha uma pílula clara por trás do ícone. Navegando no GPS a barra some.
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import { colors } from '../theme/tokens.ts';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_BAR_H = 66;
const GAP = 10;

/** Quanto a barra ocupa embaixo (pra a tela deixar esse espaço livre). */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_H + GAP + Math.max(insets.bottom - 6, 4);
}

// vidro de verdade no navegador; no app nativo, fundo escuro quase opaco
const glass = Platform.OS === 'web'
  ? ({ backgroundColor: 'rgba(16,20,27,0.62)', backdropFilter: 'blur(22px) saturate(170%)',
       WebkitBackdropFilter: 'blur(22px) saturate(170%)' } as object)
  : { backgroundColor: 'rgba(16,20,27,0.94)' };

export function GlassTabBar({ state, descriptors, navigation, hidden }: BottomTabBarProps & { hidden?: boolean }) {
  const insets = useSafeAreaInsets();
  if (hidden) return null;
  const routes = state.routes.filter((r) => {
    const o = descriptors[r.key].options as { href?: unknown; tabBarItemStyle?: { display?: string } };
    return o.href !== null && o.tabBarItemStyle?.display !== 'none';
  });

  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: Math.max(insets.bottom - 6, 4) + GAP / 2 }]}>
      <View style={[s.bar, glass]} accessibilityRole="tablist">
        {routes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = state.routes[state.index]?.key === route.key;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const color = focused ? colors.neon : 'rgba(237,239,242,0.72)';
          const badge = options.tabBarBadge;
          const onPress = () => {
            const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !ev.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }}
                       accessibilityLabel={`${label}${badge ? `, ${badge} novas` : ''}`}
                       style={({ pressed }) => [s.item, focused && s.itemOn, pressed && { opacity: 0.75 }]}>
              <View>
                {options.tabBarIcon?.({ focused, color, size: 24 })}
                {badge != null && (
                  <View style={s.badge}><Text style={s.badgeTxt}>{String(badge)}</Text></View>
                )}
              </View>
              <Text style={[s.label, { color }, focused && { fontWeight: '800' }]} numberOfLines={1}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 12 },
  bar: {
    width: '100%', maxWidth: 520, height: TAB_BAR_H, borderRadius: TAB_BAR_H / 2, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  item: { flex: 1, height: TAB_BAR_H - 12, borderRadius: (TAB_BAR_H - 12) / 2, alignItems: 'center', justifyContent: 'center', gap: 2 },
  itemOn: { backgroundColor: 'rgba(198,255,61,0.14)' },
  label: { fontSize: 11, fontWeight: '600' },
  badge: { position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger,
           alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: colors.bg },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

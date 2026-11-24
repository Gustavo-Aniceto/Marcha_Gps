import React from 'react';
import { Tabs } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../src/theme/tokens.ts';

const icons: Record<string, string> = {
  index: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z M9 4v14 M15 6v14',
  feed: 'M4 5h16v11H8l-4 4V5Z',
  garagem: 'M3 16v-3l2-5h14l2 5v3H3Z',
  ranks: 'M8 4h8v5a4 4 0 0 1-8 0V4Z M12 13v4 M8 20h8',
  equipes: 'M3 20a6 6 0 0 1 12 0 M16 5a3 3 0 0 1 0 6 M18 20a6 6 0 0 0-3-5.2',
};

function Icon({ name, color }: { name: string; color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round">
      <Path d={icons[name]} />
      {name === 'garagem' && <><Circle cx={7.5} cy={17.5} r={2} /><Circle cx={16.5} cy={17.5} r={2} /></>}
      {name === 'equipes' && <Circle cx={9} cy={8} r={3} />}
    </Svg>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.neon,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: '#0F1218', borderTopColor: '#222836', height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => <Icon name={route.name} color={color} />,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="garagem" options={{ title: 'Garagem' }} />
      <Tabs.Screen name="ranks" options={{ title: 'Ranks' }} />
      <Tabs.Screen name="equipes" options={{ title: 'Equipes' }} />
    </Tabs>
  );
}

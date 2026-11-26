import React, { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TUTORIAL_KEY } from '../../src/lib/tutorial.ts';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../src/theme/tokens.ts';
import { useNavigation } from '../../src/lib/navigation';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';

const icons: Record<string, string> = {
  index: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z M9 4v14 M15 6v14',
  feed: 'M4 5h16v11H8l-4 4V5Z',
  garagem: 'M3 16v-3l2-5h14l2 5v3H3Z',
  ranks: 'M8 4h8v5a4 4 0 0 1-8 0V4Z M12 13v4 M8 20h8',
  equipes: 'M3 20a6 6 0 0 1 12 0 M16 5a3 3 0 0 1 0 6 M18 20a6 6 0 0 0-3-5.2',
  conta: 'M5 20a7 7 0 0 1 14 0',
};

function Icon({ name, color }: { name: string; color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round">
      <Path d={icons[name]} />
      {name === 'garagem' && <><Circle cx={7.5} cy={17.5} r={2} /><Circle cx={16.5} cy={17.5} r={2} /></>}
      {name === 'equipes' && <Circle cx={9} cy={8} r={3} />}
      {name === 'conta' && <Circle cx={12} cy={8} r={4} />}
    </Svg>
  );
}

export default function TabsLayout() {
  // navegando: a barra de abas some e o mapa ocupa a tela toda (como nos apps de GPS)
  const navigating = useNavigation().status !== 'idle';
  const router = useRouter();
  const { profile } = useSession();
  // bolinha de notificações não lidas na aba Conta (confere a cada minuto)
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!profile) return;
    let alive = true;
    const check = () => db.rpc('unread_notifications').then(({ data }) => { if (alive) setUnread(Number(data ?? 0)); });
    check();
    const t = setInterval(check, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [profile?.id]);
  // primeira vez no app: abre o tutorial (depois fica no menu ☰ do mapa, em "Como usar o app")
  useEffect(() => {
    AsyncStorage.getItem(TUTORIAL_KEY).then((v) => { if (!v) router.push('/tutorial'); }).catch(() => {});
  }, []);
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.neon,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: navigating && route.name === 'index' ? { display: 'none' }
          : { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarLine, minHeight: 60, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => <Icon name={route.name} color={color} />,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="equipes" options={{ title: 'Equipes' }} />
      <Tabs.Screen name="garagem" options={{ title: 'Garagem' }} />
      <Tabs.Screen name="conta" options={{ title: 'Conta', tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
                                           tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 } }} />
      {/* Ranks sai da barra (fica em Conta e em Equipes) */}
      <Tabs.Screen name="ranks" options={{ title: 'Ranks', href: null }} />
    </Tabs>
  );
}

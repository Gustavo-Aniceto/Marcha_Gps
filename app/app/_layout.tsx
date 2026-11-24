import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import { SessionProvider, useSession } from '../src/lib/session';
import { MapSettingsProvider } from '../src/lib/mapSettings';
import { colors } from '../src/theme/tokens.ts';

// Manda cada um pro lugar certo: sem login -> entrar; logado sem convite -> convite; senão -> abas.
function Gate() {
  const { loading, session, profile } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!session) {
      if (!inAuth || segments[1] !== 'entrar') router.replace('/(auth)/entrar');
    } else if (!profile) {
      if (!inAuth || segments[1] !== 'convite') router.replace('/(auth)/convite');
    } else if (inAuth) {
      router.replace('/(tabs)');
    }
  }, [loading, session, profile, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.neon} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="radar" options={{ presentation: 'modal' }} />
      <Stack.Screen name="camera-mapa" options={{ presentation: 'modal' }} />
      <Stack.Screen name="visibilidade" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'ChakraPetch-Bold': ChakraPetch_700Bold,
    'ShareTechMono-Regular': ShareTechMono_400Regular,
  });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <MapSettingsProvider>
          <Gate />
        </MapSettingsProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { ClerkProvider } from '@clerk/expo';
import { ptBR } from '@clerk/localizations';
import { tokenCache } from '../src/lib/clerkTokenCache';
import { ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import { SessionProvider, useSession } from '../src/lib/session';
import { NavigationProvider } from '../src/lib/navigation';
import { MapSettingsProvider } from '../src/lib/mapSettings';
import { colors } from '../src/theme/tokens.ts';

// Manda cada um pro lugar certo: sem login -> entrar; logado sem convite -> convite; senão -> abas.
// As telas do app só existem (Stack.Protected) pra quem já entrou com convite: o mapa nem monta antes disso.
function Gate() {
  const { loading, signedIn, profile } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const inside = signedIn && !!profile;

  useEffect(() => {
    if (loading || inside) return;
    const want = signedIn ? 'convite' : 'entrar';
    if (segments[0] !== '(auth)' || segments[1] !== want) router.replace(`/(auth)/${want}`);
  }, [loading, inside, signedIn, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.neon} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!inside}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={inside}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cena" />
        <Stack.Screen name="midia/[id]" />
        <Stack.Screen name="evento/[id]" />
        <Stack.Screen name="meu-qr" options={{ presentation: 'modal' }} />
        <Stack.Screen name="escanear" options={{ presentation: 'modal' }} />
        <Stack.Screen name="evento-novo" options={{ presentation: 'modal' }} />
        <Stack.Screen name="radar" options={{ presentation: 'modal' }} />
        <Stack.Screen name="camera-mapa" options={{ presentation: 'modal' }} />
        <Stack.Screen name="visibilidade" options={{ presentation: 'modal' }} />
        <Stack.Screen name="destino" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

const clerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!clerkKey) throw new Error('Configure EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY no app/.env');

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'ChakraPetch-Bold': ChakraPetch_700Bold,
    'ShareTechMono-Regular': ShareTechMono_400Regular,
  });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ClerkProvider publishableKey={clerkKey} tokenCache={tokenCache} localization={ptBR}>
        <SessionProvider>
          <MapSettingsProvider>
            <NavigationProvider>
              <Gate />
            </NavigationProvider>
          </MapSettingsProvider>
        </SessionProvider>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

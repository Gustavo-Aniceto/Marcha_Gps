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
import { clearPendingInvite, loadPendingInvite } from '../src/lib/pendingInvite';
import { db } from '../src/lib/db';
import { MapSettingsProvider } from '../src/lib/mapSettings';
import { colors } from '../src/theme/tokens.ts';
import { pickClerkKey } from '../src/lib/clerkKey.ts';

// Manda cada um pro lugar certo: sem login -> entrar; logado sem convite -> convite; senão -> abas.
// As telas do app só existem (Stack.Protected) pra quem já entrou com convite: o mapa nem monta antes disso.
function Gate() {
  const { loading, signedIn, profile } = useSession();
  const segments = useSegments() as string[];
  const router = useRouter();
  const inside = signedIn && !!profile;

  // Ordem: convite (inicio) -> login com a conta que preferir (entrar) -> nome de usuário (convite) -> app
  useEffect(() => {
    if (loading || inside) return;
    const here = segments[0] === '(auth)' ? segments[1] : null;
    if (signedIn) {
      if (here !== 'convite') router.replace('/(auth)/convite');
    } else if (here !== 'inicio' && here !== 'entrar') {
      router.replace('/(auth)/inicio');
    }
  }, [loading, inside, signedIn, segments, router]);

  // membro que já tem conta e entrou com convite de outra equipe: entra nela sozinho
  useEffect(() => {
    if (!inside) return;
    loadPendingInvite().then(async (p) => {
      if (!p) return;
      await db.rpc('redeem_invite', { p_code: p.code, p_username: null });
      await clearPendingInvite();
    });
  }, [inside]);

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
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="perfil/[username]" />
        <Stack.Screen name="equipe/[id]" />
        <Stack.Screen name="tutorial" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}

const clerkKey: string = pickClerkKey(typeof window !== 'undefined' && window.location ? window.location.hostname : null,
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD) ?? '';
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

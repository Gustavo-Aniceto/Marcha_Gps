import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { ClerkProvider } from '@clerk/expo';
// só o português (o pacote inteiro trazia todas as línguas e deixava o app ~4 MB mais pesado)
import { ptBR } from '@clerk/localizations/pt-BR';
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
import { installErrorReporting, reportError, setErrorScreen } from '../src/lib/reportErrors';

installErrorReporting();

// Páginas abertas com ou sem login (o Facebook/Google e as lojas pedem o link da política de privacidade)
const PUBLIC = ['privacidade', 'termos'];

// Manda cada um pro lugar certo: sem login -> entrar; logado sem convite -> convite; senão -> abas.
// As telas do app só existem (Stack.Protected) pra quem já entrou com convite: o mapa nem monta antes disso.
function Gate() {
  const { loading, signedIn, profile } = useSession();
  const segments = useSegments() as string[];
  const router = useRouter();
  const inside = signedIn && !!profile;
  const pathname = usePathname();
  useEffect(() => { setErrorScreen(pathname); }, [pathname]);

  // Ordem: convite (inicio) -> login com a conta que preferir (entrar) -> nome de usuário (convite) -> app
  useEffect(() => {
    if (loading || inside) return;
    if (PUBLIC.includes(segments[0])) return;
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
      <Stack.Screen name="privacidade" />
      <Stack.Screen name="termos" />
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
        <Stack.Screen name="moderacao" />
      </Stack.Protected>
    </Stack>
  );
}

const clerkKey: string = pickClerkKey(typeof window !== 'undefined' && window.location ? window.location.hostname : null,
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD) ?? '';
if (!clerkKey) throw new Error('Configure EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY no app/.env');

// Se uma tela quebrar, mostra um aviso em vez de tela branca (e o erro vai pro Adm Master)
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { reportError(error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>Algo deu errado nessa tela</Text>
        <Text style={{ color: colors.textDim, textAlign: 'center', lineHeight: 20 }}>O erro já foi mandado pra gente consertar.</Text>
        <Pressable accessibilityRole="button" onPress={() => {
          this.setState({ failed: false });
          if (typeof window !== 'undefined' && window.location) window.location.assign('/');
        }} style={{ minHeight: 48, paddingHorizontal: 22, borderRadius: 14, backgroundColor: colors.neon, justifyContent: 'center' }}>
          <Text style={{ color: colors.ink, fontWeight: '800' }}>Voltar pro início</Text>
        </Pressable>
      </View>
    );
  }
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
      <ClerkProvider publishableKey={clerkKey} tokenCache={tokenCache} localization={ptBR}>
        <SessionProvider>
          <MapSettingsProvider>
            <NavigationProvider>
              <ErrorBoundary>
                <Gate />
              </ErrorBoundary>
            </NavigationProvider>
          </MapSettingsProvider>
        </SessionProvider>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

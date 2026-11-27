// Primeira tela: o convite vem antes de tudo. Confere o código (sem login) e só então
// leva pra entrar com a conta que a pessoa preferir (Google ou código no e-mail).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Body, Button, ErrorText, Field, Screen } from '../../src/components/ui';
import { checkInvite, RoutingError } from '../../src/lib/routing';
import { formatInviteCode, inviteStatusText, loadPendingInvite, savePendingInvite } from '../../src/lib/pendingInvite';
import { missingInvite } from '../../src/lib/pendingInviteText.ts';
import { NoInviteCard } from '../../src/components/NoInviteCard';
import { colors, fonts } from '../../src/theme/tokens.ts';

export default function Inicio() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noInvite, setNoInvite] = useState(false); // tentou seguir sem código

  // veio do link do convite (marcha-gps.vercel.app/c/XXXX-XXXX): já preenche e confere
  const { codigo } = useLocalSearchParams<{ codigo?: string }>();
  const fromLink = useRef(false);
  // já tinha digitado antes (ex.: voltou do login): preenche
  useEffect(() => {
    if (codigo) {
      const c = formatInviteCode(String(codigo));
      if (c.length === 9) { setCode(c); fromLink.current = true; return; }
    }
    loadPendingInvite().then((p) => { if (p) setCode(p.code); });
  }, [codigo]);
  useEffect(() => { if (fromLink.current && code.length === 9) { fromLink.current = false; check(); } }, [code]);

  async function check() {
    setError(null);
    if (missingInvite(code)) { setNoInvite(true); return; }
    setNoInvite(false); setBusy(true);
    let r;
    try {
      r = await checkInvite(code);
    } catch (e) {
      setBusy(false);
      setError(e instanceof RoutingError && e.message === 'muitas_tentativas'
        ? 'Muitas tentativas. Espera um minuto.' : 'Sem conexão. Tenta de novo.');
      return;
    }
    setBusy(false);
    if (r.status !== 'ok') { setError(inviteStatusText(r.status)); return; }
    await savePendingInvite({ code, kind: r.kind ?? 'app', crewName: r.crew_name });
    router.push('/(auth)/entrar');
  }

  return (
    <Screen>
      <View style={{ gap: 6, marginTop: 24, marginBottom: 8 }}>
        <Text style={{ fontFamily: fonts.brand, fontSize: 40, color: colors.neon, letterSpacing: 1.5 }}>
          MARCHA <Text style={{ color: colors.text }}>GPS</Text>
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Carros modificados e originais.</Text>
      </View>

      <Text style={{ color: colors.text, fontFamily: fonts.display, fontWeight: '800', letterSpacing: -0.3, fontSize: 22 }}>Tem convite?</Text>
      <Body dim>
        Aqui só entra quem é convidado por alguém da cena. Recebeu o link do convite? Toque nele que o código já
        vem preenchido. Ou digite o código abaixo.
      </Body>

      <Field label="Código de convite" value={code} onChangeText={(t) => { setCode(formatInviteCode(t)); setError(null); setNoInvite(false); }}
             autoCapitalize="characters" autoCorrect={false} placeholder="Ex.: 7K2Q-LF9A" maxLength={9}
             returnKeyType="go" onSubmitEditing={check} />
      <ErrorText>{error}</ErrorText>
      {noInvite && <NoInviteCard />}
      <Button title="Continuar" onPress={check} loading={busy} />

      <Pressable onPress={() => router.push('/(auth)/entrar')} accessibilityRole="link"
                 style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
        <Text style={{ color: colors.holo, fontSize: 15 }}>Já sou membro · Entrar</Text>
      </Pressable>
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
        Ao continuar você concorda com os{' '}
        <Text style={{ color: colors.holo }} accessibilityRole="link" onPress={() => router.push('/termos' as never)}>Termos de uso</Text>
        {' '}e a{' '}
        <Text style={{ color: colors.holo }} accessibilityRole="link" onPress={() => router.push('/privacidade' as never)}>Política de privacidade</Text>.
        {' '}Pra maiores de 18 anos.
      </Text>
    </Screen>
  );
}

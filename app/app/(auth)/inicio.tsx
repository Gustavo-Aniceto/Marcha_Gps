// Primeira tela: o convite vem antes de tudo. Confere o código (sem login) e só então
// leva pra entrar com a conta que a pessoa preferir (Google, Apple, Facebook ou e-mail).
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Body, Button, ErrorText, Field, Screen } from '../../src/components/ui';
import { db } from '../../src/lib/db';
import { formatInviteCode, inviteStatusText, loadPendingInvite, savePendingInvite } from '../../src/lib/pendingInvite';
import { colors, fonts } from '../../src/theme/tokens.ts';

export default function Inicio() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // já tinha digitado antes (ex.: voltou do login): preenche
  useEffect(() => { loadPendingInvite().then((p) => { if (p) setCode(p.code); }); }, []);

  async function check() {
    setError(null); setBusy(true);
    const { data, error: e } = await db.rpc('check_invite', { p_code: code }).maybeSingle();
    setBusy(false);
    const r = data as { status: string; kind: 'fundador' | 'equipe' | null; crew_name: string | null } | null;
    if (e || !r) { setError('Sem conexão. Tenta de novo.'); return; }
    if (r.status !== 'ok') { setError(inviteStatusText(r.status)); return; }
    await savePendingInvite({ code, kind: r.kind ?? 'equipe', crewName: r.crew_name });
    router.push('/(auth)/entrar');
  }

  return (
    <Screen>
      <View style={{ gap: 6, marginTop: 24, marginBottom: 8 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.neon, letterSpacing: 1.5 }}>
          MARCHA <Text style={{ color: colors.text }}>GPS</Text>
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>O GPS da cena rebaixada.</Text>
      </View>

      <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 22 }}>Tem convite?</Text>
      <Body dim>
        Aqui só entra quem é convidado por alguém da cena. Digite o código que você recebeu; depois você entra
        com a conta que preferir.
      </Body>

      <Field label="Código de convite" value={code} onChangeText={(t) => { setCode(formatInviteCode(t)); setError(null); }}
             autoCapitalize="characters" autoCorrect={false} placeholder="Ex.: 7K2Q-LF9A" maxLength={9}
             returnKeyType="go" onSubmitEditing={() => code.length === 9 && check()} />
      <ErrorText>{error}</ErrorText>
      <Button title="Continuar" onPress={check} loading={busy} disabled={code.length !== 9} />

      <Pressable onPress={() => router.push('/(auth)/entrar')} accessibilityRole="link"
                 style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
        <Text style={{ color: colors.holo, fontSize: 15 }}>Já sou membro · Entrar</Text>
      </Pressable>
    </Screen>
  );
}

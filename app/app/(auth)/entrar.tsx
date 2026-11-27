// Login (depois do convite): Google ou código no e-mail, pelo Neon Auth.
// Depois de entrar, o Gate do _layout leva pro convite (conta nova) ou pro mapa (quem já é membro).
import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Body, Button, ErrorText, Field, Screen } from '../../src/components/ui';
import { InviteBadge } from '../../src/components/InviteBadge';
import { authClient } from '../../src/lib/auth';
import { authErrorText, EMAIL_RE } from '../../src/lib/authUrl.ts';
import { useSession } from '../../src/lib/session';
import { colors, fonts } from '../../src/theme/tokens.ts';

type Step = 'email' | 'codigo';

export default function Entrar() {
  const { refreshAuth } = useSession();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | 'codigo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanEmail = email.trim().toLowerCase();

  async function google() {
    setBusy('google'); setError(null);
    try {
      // vai pro Google e volta pro app; na volta o SDK troca o código pela sessão sozinho
      const back = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
      const r = await authClient.signIn.social({ provider: 'google', callbackURL: back });
      if (r?.error) throw r.error;
    } catch (e) {
      setError(authErrorText(e)); setBusy(null);
    }
  }

  async function sendCode() {
    if (!EMAIL_RE.test(cleanEmail)) { setError('Esse e-mail não parece certo.'); return; }
    setBusy('email'); setError(null);
    try {
      const r = await authClient.emailOtp.sendVerificationOtp({ email: cleanEmail, type: 'sign-in' });
      if (r?.error) throw r.error;
      setCode(''); setStep('codigo');
    } catch (e) {
      setError(authErrorText(e));
    } finally { setBusy(null); }
  }

  async function enter() {
    const otp = code.replace(/\D/g, '');
    if (otp.length < 6) { setError('O código tem 6 números.'); return; }
    setBusy('codigo'); setError(null);
    try {
      const r = await authClient.signIn.emailOtp({ email: cleanEmail, otp });
      if (r?.error) throw r.error;
      await refreshAuth(); // o Gate leva pro próximo passo
    } catch (e) {
      setError(authErrorText(e)); setBusy(null);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 6, paddingTop: 12 }}>
        <Text style={{ fontFamily: fonts.brand, fontSize: 36, color: colors.neon, letterSpacing: 1.5 }} accessibilityRole="header">
          MARCHA <Text style={{ color: colors.text }}>GPS</Text>
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Carros modificados e originais. Aqui só entra quem é convidado.</Text>
      </View>
      <InviteBadge />

      {step === 'email' ? (
        <View style={{ gap: 14 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Entrar</Text>
          <Button title="Continuar com Google" variant="secondary" loading={busy === 'google'} disabled={!!busy} onPress={google} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>ou com o seu e-mail</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          </View>
          <Field label="E-mail" value={email} onChangeText={(v) => { setEmail(v); setError(null); }}
                 placeholder="voce@email.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                 autoComplete="email" textContentType="emailAddress" onSubmitEditing={sendCode} returnKeyType="send" />
          <Button title="Receber código" loading={busy === 'email'} disabled={!!busy || !cleanEmail} onPress={sendCode} />
          <Body dim>A gente manda um código de 6 números pro seu e-mail. Sem senha pra lembrar.</Body>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Confere seu e-mail</Text>
          <Body dim>Mandamos um código pra {cleanEmail}. Olha também no spam.</Body>
          <Field label="Código" value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                 placeholder="000000" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
                 maxLength={6} onSubmitEditing={enter} returnKeyType="go"
                 style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center', fontFamily: fonts.mono }} />
          <Button title="Entrar" loading={busy === 'codigo'} disabled={!!busy || code.length < 6} onPress={enter} />
          <Button title="Mandar outro código" variant="secondary" disabled={!!busy} onPress={sendCode} />
          <Button title="Trocar e-mail" variant="secondary" disabled={!!busy} onPress={() => { setStep('email'); setError(null); }} />
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

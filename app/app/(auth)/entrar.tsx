// Login sem senha: código de 6 dígitos no e-mail (Supabase OTP).
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, ErrorText, Field, Screen } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
import { colors, fonts } from '../../src/theme/tokens.ts';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setError(null); setBusy(true);
    const { error: e } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
    setBusy(false);
    if (e) setError('Não deu pra mandar o código. Confere o e-mail.');
    else setSent(true);
  }

  async function verify() {
    setError(null); setBusy(true);
    const { error: e } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (e) setError('Código errado ou vencido.');
    // deu certo: o Gate do _layout leva pro convite ou pro mapa
  }

  return (
    <Screen>
      <View style={{ marginTop: 40, gap: 10 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 36, color: colors.neon, letterSpacing: 1.5 }}>
          MARCHA <Text style={{ color: colors.text }}>GPS</Text>
        </Text>
        <Body dim>O GPS da cena rebaixada. Aqui só entra quem é convidado.</Body>
      </View>
      <Field
        label="Seu e-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!sent}
      />
      {sent && (
        <Field
          label="Código que chegou no e-mail"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          maxLength={6}
        />
      )}
      <ErrorText>{error}</ErrorText>
      {sent
        ? <Button title="Entrar" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
        : <Button title="Mandar código" onPress={sendCode} loading={busy} disabled={!email.includes('@')} />}
      {sent && <Button title="Usar outro e-mail" variant="secondary" onPress={() => { setSent(false); setCode(''); }} />}
    </Screen>
  );
}

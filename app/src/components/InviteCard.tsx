// Código de convite em destaque, com Copiar e Enviar.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Mono } from './ui';
import { copyText, inviteMessage, shareText } from '../lib/share';
import { colors, fonts } from '../theme/tokens.ts';

export function InviteCard({ code, kind, accent = colors.neon, expiresAt }:
  { code: string; kind: 'founder' | 'app'; accent?: string; expiresAt?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card accent={accent}>
      <Mono color={accent}>{kind === 'founder' ? 'CÓDIGO DE FUNDADOR' : 'CONVITE PRO APP'}</Mono>
      <Text selectable style={{ color: colors.text, fontFamily: fonts.display, fontSize: 34, letterSpacing: 3, textAlign: 'center', marginVertical: 6 }}>
        {code}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
        {kind === 'founder' ? 'Não vence · ' : expiresAt ? `Vale até ${new Date(expiresAt).toLocaleDateString('pt-BR')} · ` : 'Vale 7 dias · '}uma pessoa só
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <Button title="Copiar" variant="secondary" color={accent} onPress={async () => setMsg((await copyText(code)) ? 'Código copiado.' : 'Segure no código pra copiar.')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Enviar" color={accent} onPress={async () => {
            const r = await shareText(inviteMessage(code, kind));
            setMsg(r === 'copied' ? 'Mensagem copiada. Cola no WhatsApp.' : r === 'failed' ? 'Segure no código pra copiar.' : null);
          }} />
        </View>
      </View>
      {msg && <Text style={{ color: colors.textDim, fontSize: 13, textAlign: 'center' }}>{msg}</Text>}
    </Card>
  );
}

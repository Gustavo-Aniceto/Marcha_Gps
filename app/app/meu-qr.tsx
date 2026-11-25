// QR do membro pra check-in presencial: mostra pro admin da equipe no encontro, com o carro.
import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Body, Button, Card, Mono, Screen, Title } from '../src/components/ui';
import { useSession } from '../src/lib/session';
import { checkinPayload } from '../src/lib/checkinQr.ts';
import { colors } from '../src/theme/tokens.ts';
import { goBack } from '../src/lib/goBack';

export default function MeuQr() {
  const router = useRouter();
  const { crew, nome } = useLocalSearchParams<{ crew: string; nome?: string }>();
  const { profile } = useSession();
  let value: string | null = null;
  try { value = crew && profile ? checkinPayload(crew, profile.id) : null; } catch { value = null; }

  return (
    <Screen>
      <Title>Seu QR de check-in</Title>
      <Mono>{(nome ?? 'EQUIPE').toUpperCase()} · @{profile?.username}</Mono>
      <Card style={{ alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        {value
          ? <View accessible accessibilityLabel="QR code de check-in"><QRCode value={value} size={240} color={colors.ink} backgroundColor="#FFFFFF" /></View>
          : <Body>Não deu pra gerar o QR.</Body>}
      </Card>
      <Body dim>Mostra pra um admin da equipe no próximo encontro. Ele escaneia e confirma que te viu lá com o carro.</Body>
      <Button title="Pronto" onPress={() => goBack(router)} />
    </Screen>
  );
}

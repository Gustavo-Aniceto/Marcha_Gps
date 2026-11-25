// Admin escaneia o QR do membro no encontro. O banco (admin_checkin) confere se pode.
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Body, Button, Card, ErrorText, Mono, Screen, Title } from '../src/components/ui';
import { db } from '../src/lib/db';
import { friendlyError } from '../src/lib/errors.ts';
import { parseCheckin } from '../src/lib/checkinQr.ts';
import { colors } from '../src/theme/tokens.ts';
import { goBack } from '../src/lib/goBack';

export default function Escanear() {
  const router = useRouter();
  const { crew } = useLocalSearchParams<{ crew: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const busy = useRef(false);
  const [result, setResult] = useState<{ username: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onScan(text: string) {
    if (busy.current || result) return;
    busy.current = true;
    setError(null);
    try {
      const qr = parseCheckin(text);
      if (!qr) throw new Error('QR que não é do Marcha GPS.');
      if (qr.crewId !== crew) throw new Error('Esse QR é de outra equipe.');
      const { data, error: e } = await db.rpc('admin_checkin', { p_crew: crew, p_member: qr.userId, p_event: null });
      if (e) throw e;
      const { data: p } = await db.from('profiles').select('username').eq('id', qr.userId).maybeSingle();
      setResult({ username: (p as { username: string } | null)?.username ?? 'membro', status: data as string });
    } catch (e) {
      setError(e instanceof Error && !('code' in e) ? e.message : friendlyError(e));
    } finally {
      setTimeout(() => { busy.current = false; }, 1500);
    }
  }

  if (!permission) return <Screen><Body dim>Carregando câmera...</Body></Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Title>Check-in</Title>
        <Button title="Liberar câmera" onPress={requestPermission} />
        <Button title="Voltar" variant="secondary" onPress={() => goBack(router)} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Title>Check-in no encontro</Title>
      <Body dim>Aponte pro QR do membro. Só confirme se a pessoa e o carro estão aí na sua frente.</Body>
      {result ? (
        <Card accent={colors.neon}>
          <Mono color={colors.neon}>CHECK-IN FEITO · @{result.username}</Mono>
          <Body>{result.status === 'verified' ? 'Membro verificado!' : 'Check-in registrado. Ainda faltam confirmações de outros membros.'}</Body>
          <Button title="Escanear outro" onPress={() => setResult(null)} />
        </Card>
      ) : (
        <View style={{ flex: 1, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.lineStrong }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={({ data }) => onScan(data)} />
        </View>
      )}
      <ErrorText>{error}</ErrorText>
      <Button title="Fechar" variant="secondary" onPress={() => goBack(router)} />
    </Screen>
  );
}

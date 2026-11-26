// Fazer a mídia: foto pela câmera do app (galeria não vale), no local e no horário do evento.
// O banco confere o lugar e o horário; o serviço de fotos confere quem mandou.
import React, { useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Body, Button, Card, ErrorText, Mono, Screen, Title } from '../../src/components/ui';
import { db } from '../../src/lib/db';
import { friendlyError } from '../../src/lib/errors.ts';
import { uploadPhoto } from '../../src/lib/photos';
import { colors } from '../../src/theme/tokens.ts';
import { goBack } from '../../src/lib/goBack';

export default function Midia() {
  const router = useRouter();
  const { id, titulo } = useLocalSearchParams<{ id: string; titulo?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function take() {
    setError(null);
    const pic = await camera.current?.takePictureAsync({ quality: 0.7 });
    if (pic?.uri) setShot(pic.uri);
  }

  async function send() {
    if (!shot || !id) return;
    setBusy(true); setError(null);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const key = await uploadPhoto(shot, 'media');
      const { error: e } = await db.rpc('submit_event_media_checked', {
        p_event: id, p_photo_key: key, p_lat: loc.coords.latitude, p_lon: loc.coords.longitude,
      });
      if (e) throw e;
      setDone(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Title>Presença confirmada</Title>
        {shot && <Image source={{ uri: shot }} style={{ height: 260, borderRadius: 14 }} accessibilityLabel="Sua mídia" />}
        <Card accent={colors.neon}>
          <Mono color={colors.neon}>+50 XP NA EQUIPE</Mono>
          <Body dim>A mídia vai pra galeria do evento. O admin pode contestar em até 24 h.</Body>
        </Card>
        <Button title="Voltar" onPress={() => goBack(router)} />
      </Screen>
    );
  }

  if (!permission) return <Screen><Body dim>Carregando câmera...</Body></Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Title>Fazer a mídia</Title>
        <Body dim>Pra provar que você foi, a foto é tirada na hora pela câmera do app.</Body>
        <Button title="Liberar câmera" onPress={requestPermission} />
        <Button title="Voltar" variant="secondary" onPress={() => goBack(router)} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Title>Fazer a mídia</Title>
      <Mono>{(titulo ?? 'EVENTO').toUpperCase()}</Mono>
      <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.lineStrong }}>
        {shot
          ? <Image source={{ uri: shot }} style={{ flex: 1 }} accessibilityLabel="Foto tirada" />
          : <CameraView ref={camera} style={{ flex: 1 }} facing="back" />}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        Seu carro inteiro na foto, com o lugar aparecendo atrás. Só vale foto tirada agora; da galeria não conta.
      </Text>
      <ErrorText>{error}</ErrorText>
      {shot ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="Tirar outra" variant="secondary" onPress={() => setShot(null)} /></View>
          <View style={{ flex: 1 }}><Button title="Enviar" onPress={send} loading={busy} /></View>
        </View>
      ) : (
        <Button title="Tirar a foto" onPress={take} />
      )}
    </Screen>
  );
}

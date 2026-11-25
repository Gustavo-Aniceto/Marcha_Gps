// Câmera do mapa: 3D ou 2D, ângulo e raio de visão do trajeto.
import React from 'react';
import { useRouter } from 'expo-router';
import { Body, Button, Label, Mono, Pills, Screen, Title } from '../src/components/ui';
import { useMapSettings } from '../src/lib/mapSettings';
import { PITCH_PRESETS, RADIUS_OPTIONS, cameraFor } from '../src/lib/mapCamera.ts';

export default function CameraMapa() {
  const router = useRouter();
  const { camera, setCamera } = useMapSettings();
  const cam = cameraFor(camera);

  return (
    <Screen>
      <Title>Câmera do mapa</Title>
      <Mono>{camera.theme === 'auto' ? 'AUTOMÁTICO' : camera.theme.toUpperCase()} · {camera.threeD ? '3D' : '2D'} · ÂNG {cam.pitch}° · RAIO {camera.radiusM} M</Mono>

      <Label>Visual do mapa</Label>
      <Pills options={[{ value: 'auto', label: 'Automático (pelo sol)' }, { value: 'noite', label: 'Noite (azul)' }, { value: 'dia', label: 'Dia (claro)' }]}
             value={camera.theme} onChange={(v) => setCamera({ ...camera, theme: v as 'auto' | 'noite' | 'dia' })} />

      <Label>Visão</Label>
      <Pills options={[{ value: 1, label: '3D' }, { value: 0, label: '2D plano' }]}
             value={camera.threeD ? 1 : 0} onChange={(v) => setCamera({ ...camera, threeD: v === 1 })} />

      {camera.threeD && (
        <>
          <Label>Ângulo da câmera</Label>
          <Pills options={PITCH_PRESETS.map((p) => ({ value: p.pitch, label: `${p.label} · ${p.pitch}°` }))}
                 value={camera.pitch} onChange={(v) => setCamera({ ...camera, pitch: v })} />
        </>
      )}

      <Label>Raio de visão do trajeto</Label>
      <Pills options={RADIUS_OPTIONS.map((r) => ({ value: r, label: `${r} m` }))}
             value={camera.radiusM} onChange={(v) => setCamera({ ...camera, radiusM: v })} />
      <Body dim>Quanto do caminho à frente aparece. Perto mostra mais detalhe, longe mostra mais rua.</Body>

      <Button title="Pronto" onPress={() => router.back()} />
    </Screen>
  );
}

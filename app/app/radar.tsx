// Avisar: buraco, lombada, valeta, blitz... no ponto onde a pessoa está.
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Body, Button, ErrorText, Pills, Screen, Title, Warning } from '../src/components/ui';
import { db } from '../src/lib/db';
import { friendlyError } from '../src/lib/errors.ts';
import { REPORT_KINDS, pointsText, type ReportKind } from '../src/lib/reports.ts';
import { lastKnownPosition } from '../src/lib/lastPosition';
import { goBack } from '../src/lib/goBack';

// velocidades de placa mais comuns no Brasil (0 = não sei)
const SPEEDS = [0, 30, 40, 50, 60, 70, 80, 90, 100, 110];

export default function Radar() {
  const router = useRouter();
  const [kind, setKind] = useState<ReportKind>('lombada');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [speed, setSpeed] = useState(0);

  async function send() {
    setError(null); setBusy(true);
    try {
      // GPS na hora; se o navegador não der, usa a última posição que o mapa leu
      let at: { lat: number; lon: number } | null = null;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        at = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      } catch {
        at = lastKnownPosition();
      }
      if (!at) throw new Error('sem_gps');
      const { error: e } = await db.rpc('create_report', {
        p_kind: kind, p_lat: at.lat, p_lon: at.lon,
        p_speed_limit: kind === 'radar' && speed > 0 ? speed : null,
      });
      if (e) setError(friendlyError(e)); else setDone(true);
    } catch {
      setError('Não consegui pegar sua localização.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title back>O que tem aqui?</Title>
      <Body dim>Marca no ponto onde você está agora. Só faça isso parado ou com alguém no banco do passageiro.</Body>
      <Pills
        options={REPORT_KINDS.filter((k) => k.userCanReport).map((k) => ({ value: k.kind, label: k.label }))}
        value={kind}
        onChange={(v) => { setKind(v); setDone(false); }}
      />
      {kind === 'radar' && (
        <>
          <Body>Qual a velocidade da placa?</Body>
          <Pills
            options={SPEEDS.map((v) => ({ value: v, label: v === 0 ? 'Não sei' : `${v} km/h` }))}
            value={speed}
            onChange={(v) => { setSpeed(v); setDone(false); }}
          />
        </>
      )}
      <Warning>{pointsText(kind)}</Warning>
      <ErrorText>{error}</ErrorText>
      {done
        ? <Button title="Enviado! Voltar pro mapa" onPress={() => goBack(router)} />
        : <Button title="Marcar no mapa" variant="warn" onPress={send} loading={busy} />}
      <Button title="Cancelar" variant="secondary" onPress={() => goBack(router)} />
    </Screen>
  );
}

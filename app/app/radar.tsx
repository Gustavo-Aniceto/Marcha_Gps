// Avisar: buraco, lombada, valeta, blitz... no ponto onde a pessoa está.
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Body, Button, ErrorText, Pills, Screen, Title, Warning } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { friendlyError } from '../src/lib/errors.ts';
import { REPORT_KINDS, pointsText, type ReportKind } from '../src/lib/reports.ts';

export default function Radar() {
  const router = useRouter();
  const [kind, setKind] = useState<ReportKind>('lombada');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function send() {
    setError(null); setBusy(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { error: e } = await supabase.rpc('create_report', {
        p_kind: kind, p_lat: loc.coords.latitude, p_lon: loc.coords.longitude,
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
      <Title>O que tem aqui?</Title>
      <Body dim>Marca no ponto onde você está agora. Só faça isso parado ou com alguém no banco do passageiro.</Body>
      <Pills
        options={REPORT_KINDS.filter((k) => k.userCanReport).map((k) => ({ value: k.kind, label: k.label }))}
        value={kind}
        onChange={(v) => { setKind(v); setDone(false); }}
      />
      <Warning>{pointsText(kind)}</Warning>
      <ErrorText>{error}</ErrorText>
      {done
        ? <Button title="Enviado! Voltar pro mapa" onPress={() => router.back()} />
        : <Button title="Marcar no mapa" variant="warn" onPress={send} loading={busy} />}
      <Button title="Cancelar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

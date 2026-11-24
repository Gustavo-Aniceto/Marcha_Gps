// Criar evento (fundador e admins). O banco recusa se a pessoa não for admin da equipe.
import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Body, Button, Card, ErrorText, Field, Label, Mono, Pills, Screen, Title } from '../src/components/ui';
import { db } from '../src/lib/db';
import { useSession } from '../src/lib/session';
import { friendlyError } from '../src/lib/errors.ts';
import { startFrom, whenText, type DayChoice } from '../src/lib/events.ts';

type Kind = 'encontro' | 'role' | 'pista';
type Vis = 'crew' | 'open';

const HINT: Record<Kind, string> = {
  encontro: 'Ponto fixo: a galera chega e fica. Ex.: posto, praça, estacionamento.',
  role: 'Comboio: todo mundo sai junto do ponto de partida.',
  pista: 'Só em autódromo ou área fechada com autorização.',
};

export default function EventoNovo() {
  const router = useRouter();
  const { crew } = useLocalSearchParams<{ crew: string }>();
  const { profile } = useSession();
  const [kind, setKind] = useState<Kind>('encontro');
  const [title, setTitle] = useState('');
  const [day, setDay] = useState<DayChoice>('sabado');
  const [hour, setHour] = useState(21);
  const [hours, setHours] = useState(4);
  const [vis, setVis] = useState<Vis>('crew');
  const [place, setPlace] = useState<{ lat: number; lon: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const starts = startFrom(day, hour);

  async function markPlace() {
    setError(null);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPlace({ lat: loc.coords.latitude, lon: loc.coords.longitude });
    } catch {
      setError('Não consegui pegar sua localização.');
    }
  }

  async function save() {
    if (!profile || !crew || !place) return;
    setBusy(true); setError(null);
    const ends = new Date(starts.getTime() + hours * 3_600_000);
    const { error: e } = await db.from('events').insert({
      crew_id: crew, kind, title: title.trim(), starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      lat: place.lat, lon: place.lon, radius_m: 200, visibility: vis, verified_only: true, created_by: profile.id,
    });
    setBusy(false);
    if (e) setError(friendlyError(e)); else router.back();
  }

  return (
    <Screen>
      <Title>Novo evento</Title>
      <Label>Tipo</Label>
      <Pills options={[{ value: 'encontro', label: 'Encontro' }, { value: 'role', label: 'Rolê' }, { value: 'pista', label: 'Pista' }]}
             value={kind} onChange={(v) => setKind(v as Kind)} />
      <Body dim>{HINT[kind]}</Body>
      <Field label="Nome do evento" value={title} onChangeText={setTitle} maxLength={60} placeholder="Ex.: Rolê de sábado" />
      <Label>Dia</Label>
      <Pills options={[{ value: 'hoje', label: 'Hoje' }, { value: 'amanha', label: 'Amanhã' }, { value: 'sabado', label: 'Sábado' }, { value: 'domingo', label: 'Domingo' }]}
             value={day} onChange={(v) => setDay(v as DayChoice)} />
      <Label>Começa</Label>
      <Pills options={[14, 18, 19, 20, 21, 22].map((h) => ({ value: h, label: `${h}h` }))} value={hour} onChange={setHour} />
      <Label>Dura</Label>
      <Pills options={[2, 4, 6].map((h) => ({ value: h, label: `${h} h` }))} value={hours} onChange={setHours} />
      <Mono>{whenText(starts).toUpperCase()}</Mono>
      <Label>Local</Label>
      <Card>
        <Body dim>{place ? `Marcado: ${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}` : 'Vá até o local (ou esteja nele) e marque.'}</Body>
        <Button title={place ? 'Marcar de novo aqui' : 'Usar onde estou agora'} variant="secondary" onPress={markPlace} />
      </Card>
      <Label>Quem pode ver</Label>
      <Pills options={[{ value: 'crew', label: 'Só a equipe' }, { value: 'open', label: 'Aberto pra cena' }]}
             value={vis} onChange={(v) => setVis(v as Vis)} />
      <ErrorText>{error}</ErrorText>
      <Button title="Publicar evento" onPress={save} loading={busy} disabled={title.trim().length < 2 || !place} />
      <Button title="Cancelar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

// Garagem: monta o carro que aparece no mapa. (Visual 3D e cadastro por foto vêm na próxima fase.)
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Label, Mono, Pills, Screen, Title, Warning } from '../../src/components/ui';
import { CarMarker } from '../../src/components/CarMarker';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/lib/session';
import { checkFitment, tireFor, type Suspension, type WheelPosition } from '../../src/lib/fitment.ts';
import { friendlyError } from '../../src/lib/errors.ts';

interface CarForm {
  id?: string;
  make: string; model: string; year: string; color: string;
  ride_height_cm: number; suspension: Suspension; rim: number;
  wheel_position: WheelPosition; camber_deg: number;
  tint: 'nenhuma' | 'fume' | 'limo'; spoiler: boolean; neon: 'verde' | 'azul' | 'roxo' | null;
}

const EMPTY: CarForm = {
  make: '', model: '', year: '', color: '#B9C0CB', ride_height_cm: 11, suspension: 'fixa', rim: 17,
  wheel_position: 'alinhada', camber_deg: 0, tint: 'nenhuma', spoiler: false, neon: null,
};

const COLORS = [
  ['#B9C0CB', 'Prata'], ['#2A2D34', 'Preto'], ['#EDEFF2', 'Branco'], ['#D23B3B', 'Vermelho'],
  ['#2F6FE0', 'Azul'], ['#F2C230', 'Amarelo'], ['#F07A22', 'Laranja'], ['#3FA66B', 'Verde'],
] as const;

export default function Garagem() {
  const { profile } = useSession();
  const [car, setCar] = useState<CarForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    supabase.from('cars').select('*').eq('owner_id', profile.id).eq('is_active', true).maybeSingle()
      .then(({ data }) => {
        if (data) setCar({ ...EMPTY, ...data, year: data.year ? String(data.year) : '', camber_deg: Number(data.camber_deg) });
      });
  }, [profile]));

  const set = <K extends keyof CarForm>(k: K, v: CarForm[K]) => { setCar((c) => ({ ...c, [k]: v })); setMsg(null); };
  const fit = checkFitment({
    rim: car.rim, rideHeightCm: car.ride_height_cm, wheelPosition: car.wheel_position,
    camberDeg: car.camber_deg, suspension: car.suspension,
  });

  async function save() {
    if (!profile) return;
    setBusy(true); setError(null);
    const row = {
      owner_id: profile.id, make: car.make.trim(), model: car.model.trim(),
      year: car.year ? Number(car.year) : null, color: car.color, ride_height_cm: car.ride_height_cm,
      suspension: car.suspension, rim: car.rim, wheel_position: car.wheel_position, camber_deg: car.camber_deg,
      tint: car.tint, spoiler: car.spoiler, neon: car.neon, updated_at: new Date().toISOString(),
    };
    const q = car.id
      ? supabase.from('cars').update(row).eq('id', car.id).select('id').single()
      : supabase.from('cars').insert(row).select('id').single();
    const { data, error: e } = await q;
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    setCar((c) => ({ ...c, id: data.id }));
    setMsg('Salvo. É esse carro que aparece no mapa.');
  }

  return (
    <Screen>
      <Title>Garagem</Title>
      <Card style={{ alignItems: 'center' }}>
        <CarMarker me color={car.color} neon={car.neon} heading={0} />
        <Mono color="#C6FF3D">VÃO {car.ride_height_cm} CM · ARO {car.rim} · {tireFor(car.rim) ?? '—'}</Mono>
      </Card>

      {fit.ok ? <Body dim>Fitment ok: nada encosta.</Body> : fit.warnings.map((w) => <Warning key={w}>{w}</Warning>)}

      <Field label="Marca" value={car.make} onChangeText={(v) => set('make', v)} placeholder="Ex.: Volkswagen" />
      <Field label="Modelo" value={car.model} onChangeText={(v) => set('model', v)} placeholder="Ex.: Gol G5" />
      <Field label="Ano" value={car.year} onChangeText={(v) => set('year', v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" />

      <Label>Altura (vão livre)</Label>
      <Pills options={[[15, 'Original'], [11, 'Rebaixado'], [8, 'Baixo'], [5, 'Arrastando']].map(([v, l]) => ({ value: v as number, label: `${l} · ${v} cm` }))}
             value={car.ride_height_cm} onChange={(v) => set('ride_height_cm', v)} />
      <Label>Suspensão</Label>
      <Pills options={[['original', 'Original'], ['fixa', 'Fixa'], ['rosca', 'Rosca'], ['ar', 'A ar']].map(([v, l]) => ({ value: v as Suspension, label: l }))}
             value={car.suspension} onChange={(v) => set('suspension', v)} />
      <Label>Aro</Label>
      <Pills options={[14, 15, 16, 17, 18, 19, 20].map((n) => ({ value: n, label: String(n) }))}
             value={car.rim} onChange={(v) => set('rim', v)} />
      <Label>Posição da roda</Label>
      <Pills options={[['dentro', 'Pra dentro'], ['alinhada', 'Alinhada'], ['fora', 'Pra fora']].map(([v, l]) => ({ value: v as WheelPosition, label: l }))}
             value={car.wheel_position} onChange={(v) => set('wheel_position', v)} />
      <Label>Cambagem</Label>
      <Pills options={[[0, 'Zero'], [1.5, 'Leve'], [3, 'Média'], [5, 'Forte']].map(([v, l]) => ({ value: v as number, label: l as string }))}
             value={car.camber_deg} onChange={(v) => set('camber_deg', v)} />
      <Label>Cor</Label>
      <Pills options={COLORS.map(([hex, l]) => ({ value: hex as string, label: l }))} value={car.color} onChange={(v) => set('color', v)} />
      <Label>Vidros</Label>
      <Pills options={[['nenhuma', 'Sem película'], ['fume', 'Fumê'], ['limo', 'Limo']].map(([v, l]) => ({ value: v as CarForm['tint'], label: l }))}
             value={car.tint} onChange={(v) => set('tint', v)} />
      <Label>Neon embaixo</Label>
      <Pills options={[['', 'Desligado'], ['verde', 'Verde'], ['azul', 'Azul'], ['roxo', 'Roxo']].map(([v, l]) => ({ value: v, label: l }))}
             value={car.neon ?? ''} onChange={(v) => set('neon', (v || null) as CarForm['neon'])} />
      <Label>Aerofólio</Label>
      <Pills options={[{ value: 0, label: 'Sem' }, { value: 1, label: 'Com' }]} value={car.spoiler ? 1 : 0} onChange={(v) => set('spoiler', v === 1)} />

      <ErrorText>{error}</ErrorText>
      {msg && <Body dim>{msg}</Body>}
      <Button title="Salvar e usar no mapa" onPress={save} loading={busy} disabled={!car.make.trim() || !car.model.trim()} />
    </Screen>
  );
}

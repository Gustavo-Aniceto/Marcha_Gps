// Garagem: monta o carro que aparece no mapa. (Visual 3D e cadastro por foto vêm na próxima fase.)
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Label, Mono, Pills, Screen, Title, Warning } from '../../src/components/ui';
import { CarMarker } from '../../src/components/CarMarker';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { checkFitment, tireFor, type Suspension, type WheelPosition } from '../../src/lib/fitment.ts';
import { friendlyError } from '../../src/lib/errors.ts';
import { colors, fonts } from '../../src/theme/tokens.ts';
import { BODIES, CAR_COLORS, type BodyType } from '../../src/lib/carBodies.ts';

interface CarForm {
  id?: string;
  make: string; model: string; year: string; color: string; body_type: BodyType;
  ride_height_cm: number; suspension: Suspension; rim: number;
  wheel_position: WheelPosition; camber_deg: number;
  tint: 'nenhuma' | 'fume' | 'limo'; spoiler: boolean; neon: 'verde' | 'azul' | 'roxo' | null;
}

const EMPTY: CarForm = {
  make: '', model: '', year: '', color: '#B9C0CB', body_type: 'hatch', ride_height_cm: 11, suspension: 'fixa', rim: 17,
  wheel_position: 'alinhada', camber_deg: 0, tint: 'nenhuma', spoiler: false, neon: null,
};


export default function Garagem() {
  const { profile } = useSession();
  const [car, setCar] = useState<CarForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    db.from('cars').select('*').eq('owner_id', profile.id).eq('is_active', true).maybeSingle()
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
    setMsg(null);
    if (!car.make.trim() || !car.model.trim()) { setError('Preencha a marca e o modelo do carro lá em cima.'); return; }
    const year = car.year ? Number(car.year) : null;
    const maxYear = new Date().getFullYear() + 1;
    if (year != null && (year < 1950 || year > maxYear)) {
      setError(`Ano inválido: use 4 números, de 1950 a ${maxYear} (ex.: 2009). Ou deixa em branco.`); return;
    }
    setBusy(true); setError(null);
    const row = {
      owner_id: profile.id, make: car.make.trim(), model: car.model.trim(),
      year, color: car.color, body_type: car.body_type, ride_height_cm: car.ride_height_cm,
      suspension: car.suspension, rim: car.rim, wheel_position: car.wheel_position, camber_deg: car.camber_deg,
      tint: car.tint, spoiler: car.spoiler, neon: car.neon, updated_at: new Date().toISOString(),
    };
    const q = car.id
      ? db.from('cars').update(row).eq('id', car.id).select('id').single()
      : db.from('cars').insert(row).select('id').single();
    let data: unknown = null, e: unknown = null;
    try { ({ data, error: e } = await q); } catch (x) { e = x; }
    setBusy(false);
    if (e) console.warn('garagem: salvar carro', e);
    if (e || !data) { setError(e ? friendlyError(e) : 'Não consegui salvar. Tenta de novo.'); return; }
    setCar((c) => ({ ...c, id: (data as { id: string }).id }));
    setMsg('Salvo! É esse carro que aparece no mapa, na sua localização.');
  }

  return (
    <Screen>
      <Title>Garagem</Title>
      <Card style={{ alignItems: 'center' }}>
        <CarMarker color={car.color} neon={car.neon} heading={0} body={car.body_type} tint={car.tint} spoiler={car.spoiler} size={150} />
        <Mono color={colors.neon}>VÃO {car.ride_height_cm} CM · ARO {car.rim} · {tireFor(car.rim) ?? '—'}</Mono>
      </Card>

      {fit.ok ? <Body dim>Fitment ok: nada encosta.</Body> : fit.warnings.map((w) => <Warning key={w}>{w}</Warning>)}

      <Field label="Marca" value={car.make} onChangeText={(v) => set('make', v)} placeholder="Ex.: Volkswagen" />
      <Field label="Modelo" value={car.model} onChangeText={(v) => set('model', v)} placeholder="Ex.: Gol G5" />
      <Field label="Ano (opcional, 4 números)" value={car.year} onChangeText={(v) => set('year', v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" />

      <Label>Tipo do carro</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {BODIES.map((b) => {
          const on = car.body_type === b.id;
          return (
            <Pressable key={b.id} onPress={() => set('body_type', b.id)} accessibilityRole="button"
                       accessibilityState={{ selected: on }} accessibilityLabel={`${b.label}, ex.: ${b.example}`}
                       style={{ width: '23%', minWidth: 76, alignItems: 'center', paddingVertical: 6, borderRadius: 8, borderWidth: 1.5,
                                borderColor: on ? colors.neon : colors.line, backgroundColor: on ? 'rgba(198,255,61,0.08)' : colors.panel }}>
              <CarMarker color={car.color} heading={0} body={b.id} tint={car.tint} size={56} />
              <Text style={{ color: on ? colors.neon : colors.textDim, fontSize: 12, fontWeight: on ? '700' : '500' }}>{b.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        Ex.: {BODIES.find((b) => b.id === car.body_type)?.example}
      </Text>

      <Label>Cor</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {CAR_COLORS.map(([hex, name]) => {
          const on = car.color.toUpperCase() === hex;
          return (
            <Pressable key={hex} onPress={() => set('color', hex)} accessibilityRole="button" accessibilityLabel={name}
                       accessibilityState={{ selected: on }}
                       style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                                borderWidth: 2, borderColor: on ? colors.neon : 'transparent' }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: hex, borderWidth: 1, borderColor: colors.lineStrong }} />
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: fonts.mono }}>
        {CAR_COLORS.find(([h]) => h === car.color.toUpperCase())?.[1] ?? 'Cor personalizada'}
      </Text>

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
      <Label>Vidros</Label>
      <Pills options={[['nenhuma', 'Sem película'], ['fume', 'Fumê'], ['limo', 'Limo']].map(([v, l]) => ({ value: v as CarForm['tint'], label: l }))}
             value={car.tint} onChange={(v) => set('tint', v)} />
      <Label>Neon embaixo</Label>
      <Pills options={[['', 'Desligado'], ['verde', 'Verde'], ['azul', 'Azul'], ['roxo', 'Roxo']].map(([v, l]) => ({ value: v, label: l }))}
             value={car.neon ?? ''} onChange={(v) => set('neon', (v || null) as CarForm['neon'])} />
      <Label>Aerofólio</Label>
      <Pills options={[{ value: 0, label: 'Sem' }, { value: 1, label: 'Com' }]} value={car.spoiler ? 1 : 0} onChange={(v) => set('spoiler', v === 1)} />

      <ErrorText>{error}</ErrorText>
      {msg && <Card accent={colors.neon}><Text style={{ color: colors.neon, fontWeight: '700' }}>{msg}</Text></Card>}
      <Button title="Salvar e usar no mapa" onPress={save} loading={busy} />
    </Screen>
  );
}

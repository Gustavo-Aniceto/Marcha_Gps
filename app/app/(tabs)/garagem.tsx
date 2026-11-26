// Garagem: até 5 carros por pessoa; um deles é o que aparece no mapa ("Usar este no mapa").
// Monta o carro que aparece no mapa. A pessoa manda fotos do carro e a IA monta o carrinho
// (tipo, cor, vidro, aerofólio, marca e modelo); dá pra ajustar tudo à mão antes de salvar.
// Depois da foto abre a ficha da tabela FIPE (marca, modelo, versão, ano, código, preço) pra confirmar.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Label, Mono, Pills, Screen, Title, Warning } from '../../src/components/ui';
import { CarMarker } from '../../src/components/CarMarker';
import { Car3DView } from '../../src/components/Car3D';
import { FipeSheet } from '../../src/components/FipeSheet';
import { fipeToCar, type FipeValor } from '../../src/lib/fipe.ts';
import { specFromCar } from '../../src/lib/car3dTypes';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { checkFitment, tireFor, type Suspension, type WheelPosition } from '../../src/lib/fitment.ts';
import { friendlyError } from '../../src/lib/errors.ts';
import { colors, fonts } from '../../src/theme/tokens.ts';
import { BODIES, CAR_COLORS, type BodyType } from '../../src/lib/carBodies.ts';
import { guessSummary, guessToCar } from '../../src/lib/carGuess.ts';
import { analyzeCar, carErrorText, RoutingError } from '../../src/lib/routing';
import { photoDataUri, photoUrl, uploadPhoto } from '../../src/lib/photos';

interface CarForm {
  id?: string;
  make: string; model: string; year: string; color: string; body_type: BodyType;
  ride_height_cm: number; suspension: Suspension; rim: number;
  wheel_position: WheelPosition; camber_deg: number;
  tint: 'nenhuma' | 'fume' | 'limo'; spoiler: boolean; neon: 'verde' | 'azul' | 'roxo' | null;
  photo_paths?: string[];
  is_active?: boolean;
  fipe_code?: string | null; fipe_brand?: string | null; fipe_model?: string | null; fipe_version?: string | null;
  fipe_year?: number | null; fipe_fuel?: string | null; fipe_price?: string | null; fipe_ref?: string | null;
}

const FIPE_KEYS = ['fipe_code', 'fipe_brand', 'fipe_model', 'fipe_version', 'fipe_year', 'fipe_fuel', 'fipe_price', 'fipe_ref'] as const;
const NO_FIPE = Object.fromEntries(FIPE_KEYS.map((k) => [k, null])) as Pick<CarForm, typeof FIPE_KEYS[number]>;

const EMPTY: CarForm = {
  make: '', model: '', year: '', color: '#B9C0CB', body_type: 'hatch', ride_height_cm: 11, suspension: 'fixa', rim: 17,
  wheel_position: 'alinhada', camber_deg: 0, tint: 'nenhuma', spoiler: false, neon: null,
};


export default function Garagem() {
  const { profile } = useSession();
  const [car, setCar] = useState<CarForm>(EMPTY);
  const [cars, setCars] = useState<CarForm[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // fotos escolhidas agora (ainda não enviadas) e o resultado da IA
  const [photos, setPhotos] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [guessText, setGuessText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [fipeOpen, setFipeOpen] = useState(false);
  const [fipeHint, setFipeHint] = useState<{ make?: string; model?: string; year?: number | null }>({});

  function openFipe(h?: { make?: string; model?: string; year?: number | null }) {
    setFipeHint(h ?? { make: car.make, model: car.model, year: car.year ? Number(car.year) : null });
    setFipeOpen(true);
  }

  function pickFipe(v: FipeValor, family: string) {
    const f = fipeToCar(v, family);
    setCar((c) => ({ ...c, ...f, year: f.year ? String(f.year) : c.year }));
    setFipeOpen(false); setMsg(null);
  }

  async function pickAndBuild() {
    setAiError(null); setGuessText(null);
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3, quality: 0.8,
    });
    if (r.canceled || !r.assets?.length) return;
    const uris = r.assets.slice(0, 3).map((a) => a.uri);
    setPhotos(uris);
    setAnalyzing(true);
    try {
      const data = await Promise.all(uris.map((u) => photoDataUri(u)));
      const g = await analyzeCar(data);
      const filled = guessToCar(g, car);
      setCar((c) => ({ ...c, ...filled, ...NO_FIPE }));
      setGuessText(guessSummary(g, BODIES.find((b) => b.id === g.body_type)?.label ?? g.body_type));
      setMsg(null);
      // reconheceu a marca: abre a ficha FIPE já no modelo certo pra pessoa só confirmar
      if (filled.make) openFipe({ make: filled.make, model: filled.model, year: car.year ? Number(car.year) : null });
    } catch (e) {
      setAiError(carErrorText(e instanceof RoutingError ? e.message : e instanceof Error ? e.message : ''));
    } finally {
      setAnalyzing(false);
    }
  }

  const toForm = (d: Record<string, unknown>): CarForm =>
    ({ ...EMPTY, ...(d as Partial<CarForm>), year: d.year ? String(d.year) : '', camber_deg: Number(d.camber_deg) });

  // todos os carros da garagem; abre no que está no mapa (ou no que estava aberto)
  const loadCars = useCallback(async (keepId?: string) => {
    if (!profile) return;
    const { data } = await db.from('cars').select('*').eq('owner_id', profile.id)
      .order('is_active', { ascending: false }).order('updated_at', { ascending: false });
    const list = (data ?? []).map((d) => toForm(d as Record<string, unknown>));
    setCars(list);
    const pick = list.find((c) => c.id === keepId) ?? list[0];
    if (pick) setCar(pick);
  }, [profile]);

  useFocusEffect(useCallback(() => { loadCars(car.id); }, [loadCars]));

  function openCar(c: CarForm | null) {
    setCar(c ?? EMPTY); setPhotos([]); setGuessText(null); setAiError(null); setMsg(null); setError(null); setConfirmRemove(false);
  }

  async function putOnMap() {
    if (!car.id) return;
    setBusy(true); setError(null);
    const { error: e } = await db.rpc('set_active_car', { p_car: car.id });
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    await loadCars(car.id);
    setMsg(`Pronto: o ${car.make} ${car.model} é o carro do mapa agora.`);
  }

  async function removeCar() {
    if (!car.id) return;
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setBusy(true); setError(null);
    const { error: e } = await db.from('cars').delete().eq('id', car.id);
    setBusy(false); setConfirmRemove(false);
    if (e) { setError(friendlyError(e)); return; }
    setMsg('Carro tirado da garagem.');
    await loadCars();
  }

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
    // fotos novas do carro sobem junto (ficam guardadas no carro)
    let photo_paths = car.photo_paths ?? [];
    if (photos.length) {
      try { photo_paths = await Promise.all(photos.map((u) => uploadPhoto(u, 'carro'))); }
      catch (x) { setBusy(false); setError(friendlyError(x)); return; }
    }
    const row = {
      photo_paths,
      owner_id: profile.id, make: car.make.trim(), model: car.model.trim(),
      year, color: car.color, body_type: car.body_type, ride_height_cm: car.ride_height_cm,
      suspension: car.suspension, rim: car.rim, wheel_position: car.wheel_position, camber_deg: car.camber_deg,
      tint: car.tint, spoiler: car.spoiler, neon: car.neon, updated_at: new Date().toISOString(),
      ...Object.fromEntries(FIPE_KEYS.map((k) => [k, car[k] ?? null])),
    };
    const q = car.id
      ? db.from('cars').update(row).eq('id', car.id).select('id').single()
      : db.from('cars').insert(row).select('id').single();
    let data: unknown = null, e: unknown = null;
    try { ({ data, error: e } = await q); } catch (x) { e = x; }
    setBusy(false);
    if (e) console.warn('garagem: salvar carro', e);
    if (e || !data) { setError(e ? friendlyError(e) : 'Não consegui salvar. Tenta de novo.'); return; }
    const savedId = (data as { id: string }).id;
    setPhotos([]);
    await loadCars(savedId);
    const onMap = car.id ? car.is_active : cars.length === 0;
    setMsg(onMap
      ? 'Salvo! É esse carrinho que aparece no GPS e na Cena ao vivo, com o seu @.'
      : 'Salvo na garagem. Toque em "Usar este no mapa" quando for sair com ele.');
  }

  return (
    <Screen>
      <Title>Garagem</Title>

      {/* meus carros: um fica no mapa; os outros esperam na garagem */}
      {cars.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cars.map((c) => {
            const on = c.id === car.id;
            return (
              <Pressable key={c.id} onPress={() => openCar(c)} accessibilityRole="button" accessibilityState={{ selected: on }}
                         accessibilityLabel={`${c.make} ${c.model}${c.is_active ? ', no mapa' : ''}`}
                         style={{ width: '31%', minWidth: 96, alignItems: 'center', padding: 6, borderRadius: 8, borderWidth: 1.5,
                                  borderColor: on ? colors.neon : colors.line, backgroundColor: on ? 'rgba(198,255,61,0.08)' : colors.panel }}>
                <CarMarker color={c.color} neon={c.neon} heading={0} body={c.body_type} tint={c.tint} spoiler={c.spoiler} size={52} />
                <Text style={{ color: on ? colors.neon : colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
                  {c.make} {c.model}
                </Text>
                {c.is_active && <Text style={{ color: colors.neon, fontSize: 10, fontFamily: fonts.mono }}>NO MAPA</Text>}
              </Pressable>
            );
          })}
          {cars.length < 5 && (
            <Pressable onPress={() => openCar(null)} accessibilityRole="button" accessibilityLabel="Adicionar outro carro"
                       style={{ width: '31%', minWidth: 96, minHeight: 92, alignItems: 'center', justifyContent: 'center', borderRadius: 8,
                                borderWidth: 1.5, borderStyle: 'dashed', borderColor: !car.id ? colors.neon : colors.line }}>
              <Text style={{ color: !car.id ? colors.neon : colors.textDim, fontSize: 26 }}>+</Text>
              <Text style={{ color: !car.id ? colors.neon : colors.textDim, fontSize: 12, fontWeight: '700' }}>Outro carro</Text>
            </Pressable>
          )}
        </View>
      )}
      {cars.length > 0 && !car.id && <Body dim>Carro novo: monte abaixo e salve. Ele fica na garagem até você escolher sair com ele.</Body>}

      <Card style={{ gap: 10 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Monte seu carrinho pelas fotos</Text>
        <Body dim>Manda de 1 a 3 fotos do seu carro (de lado, de frente ou de trás). A gente reconhece o tipo, a cor,
          o vidro e o aerofólio e monta o carrinho que vai aparecer no mapa. Depois você confere e ajusta.</Body>
        {(photos.length > 0 || (car.photo_paths?.length ?? 0) > 0) && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(photos.length ? photos : (car.photo_paths ?? []).map((k) => photoUrl(k) ?? '')).filter(Boolean).map((u) => (
              <Image key={u} source={{ uri: u }} style={{ width: 84, height: 63, borderRadius: 6, backgroundColor: colors.panelAlt }}
                     accessibilityLabel="Foto do carro" />
            ))}
          </View>
        )}
        {analyzing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
            <ActivityIndicator color={colors.neon} />
            <Text style={{ color: colors.textDim }}>Montando seu carrinho…</Text>
          </View>
        ) : (
          <Button title={photos.length || car.photo_paths?.length ? '📷 Mandar outras fotos' : '📷 Mandar fotos do carro'}
                  variant="secondary" onPress={pickAndBuild} />
        )}
        {guessText && (
          <Text style={{ color: colors.neon, fontWeight: '700' }} accessibilityLiveRegion="polite">Reconheci: {guessText}</Text>
        )}
        <ErrorText>{aiError}</ErrorText>
      </Card>

      <Card style={{ alignItems: 'center' }}>
        <Car3DView spec={specFromCar(car, true)} width={300} height={210} />
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Arraste pra girar · é assim que ele anda no mapa</Text>
        <Mono color={colors.neon}>VÃO {car.ride_height_cm} CM · ARO {car.rim} · {tireFor(car.rim) ?? '—'}</Mono>
      </Card>

      {fit.ok ? <Body dim>Fitment ok: nada encosta.</Body> : fit.warnings.map((w) => <Warning key={w}>{w}</Warning>)}

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Ficha do carro</Text>
          {car.fipe_code ? <Mono color={colors.textMuted}>FIPE {car.fipe_code}</Mono> : null}
        </View>
        {car.fipe_code ? (
          <>
            {([
              ['Marca', car.make], ['Modelo', car.model], ['Versão', car.fipe_version], ['Ano', car.fipe_year ? String(car.fipe_year) : 'Zero km'],
              ['Combustível', car.fipe_fuel], ['Preço FIPE', car.fipe_price],
            ] as [string, string | null | undefined][]).map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: colors.textMuted }}>{k}</Text>
                <Text style={{ color: k === 'Preço FIPE' ? colors.neon : colors.text, fontWeight: k === 'Preço FIPE' ? '800' : '400',
                               flexShrink: 1, textAlign: 'right' }} numberOfLines={2}>{v || '—'}</Text>
              </View>
            ))}
            <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: fonts.mono }}>Ref.: {car.fipe_ref}</Text>
            <Button title="Trocar a ficha" variant="secondary" onPress={() => openFipe()} />
          </>
        ) : (
          <>
            <Body dim>Puxa marca, modelo, versão, ano, combustível e preço da tabela FIPE. Fica no seu perfil.</Body>
            <Button title="Montar a ficha pela tabela FIPE" variant="secondary" onPress={() => openFipe()} />
          </>
        )}
      </Card>
      <FipeSheet visible={fipeOpen} hint={fipeHint} onClose={() => setFipeOpen(false)} onPick={pickFipe} />

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
      <Button title={car.id ? 'Salvar alterações' : cars.length === 0 ? 'Salvar e usar no mapa' : 'Salvar na garagem'} onPress={save} loading={busy} />
      {car.id && !car.is_active && (
        <Button title="Usar este no mapa" variant="secondary" onPress={putOnMap} loading={busy} />
      )}
      {car.id && (
        <Button title={confirmRemove ? 'Toque de novo pra tirar da garagem' : 'Tirar da garagem'} variant="secondary"
                color={colors.danger} onPress={removeCar} />
      )}
    </Screen>
  );
}

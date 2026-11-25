// Quem vê meu carro: fantasma, todas as minhas equipes, UMA equipe ou cena ao vivo (SP, Guarulhos, Itaquá).
// As regras de verdade ficam no banco (visible_cars); aqui só se escolhe a preferência.
import React, { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Body, Button, Card, ErrorText, Label, Mono, Pills, Screen, Title } from '../src/components/ui';
import { db, type Profile } from '../src/lib/db';
import { useSession } from '../src/lib/session';
import { friendlyError } from '../src/lib/errors.ts';
import { goBack } from '../src/lib/goBack';

const MODES: { value: Profile['visibility']; label: string; sub: string }[] = [
  { value: 'ghost', label: 'Modo fantasma', sub: 'Ninguém te vê, nem a equipe. Você ainda vê os outros.' },
  { value: 'crew', label: 'Minhas equipes', sub: 'Aparece só pra galera verificada das suas equipes (todas ou uma só).' },
  { value: 'scene', label: 'Cena ao vivo', sub: 'Seu carro aparece no mapa de SP, Guarulhos e Itaquá pra membros verificados.' },
];

export default function Visibilidade() {
  const router = useRouter();
  const { profile, refreshProfile } = useSession();
  const [mode, setMode] = useState<Profile['visibility']>(profile?.visibility ?? 'ghost');
  const [precise, setPrecise] = useState(profile?.precise_for_scene ?? false);
  const [delay, setDelay] = useState<Profile['delay_minutes']>(profile?.delay_minutes ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zones, setZones] = useState<{ id: string; label: string }[]>([]);
  const [myCrews, setMyCrews] = useState<{ id: string; name: string }[]>([]);
  const [onlyCrew, setOnlyCrew] = useState<string>(''); // '' = todas as minhas equipes

  useEffect(() => {
    if (!profile) return;
    db.from('crew_members').select('crews(id, name)').eq('user_id', profile.id).then(({ data }) =>
      setMyCrews(((data ?? []) as unknown as { crews: { id: string; name: string } }[]).map((r) => r.crews)));
    db.rpc('my_visibility').maybeSingle().then(({ data }) => {
      const v = data as { visibility: Profile['visibility']; visibility_crew: string | null } | null;
      if (v) { setMode(v.visibility); setOnlyCrew(v.visibility_crew ?? ''); }
    });
  }, [profile]);

  const loadZones = () => {
    db.from('private_zones').select('id, label').then(({ data }) => setZones(data ?? []));
  };
  useEffect(loadZones, []);

  async function addZone(label: string) {
    if (!profile) return;
    setError(null);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { error: e } = await db.from('private_zones').insert({
        user_id: profile.id, label, lat: loc.coords.latitude, lon: loc.coords.longitude, radius_m: 1000,
      });
      if (e) setError(friendlyError(e)); else loadZones();
    } catch {
      setError('Não consegui pegar sua localização.');
    }
  }

  async function removeZone(id: string) {
    await db.from('private_zones').delete().eq('id', id);
    loadZones();
  }

  async function save() {
    if (!profile) return;
    setBusy(true); setError(null);
    const { error: e1 } = await db.rpc('set_my_visibility', { p_mode: mode, p_crew: mode === 'crew' && onlyCrew ? onlyCrew : null });
    const { error: e } = e1 ? { error: e1 } : await db.from('profiles')
      .update({ precise_for_scene: precise, delay_minutes: delay })
      .eq('id', profile.id);
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    await refreshProfile();
    goBack(router);
  }

  const preview = mode === 'ghost' ? 'Invisível. Seu carro não aparece em nenhum mapa.'
    : mode === 'crew' ? (onlyCrew ? `Só a ${myCrews.find((c) => c.id === onlyCrew)?.name ?? 'equipe escolhida'} vê, com a posição exata. As outras equipes não.`
                                  : 'Todas as suas equipes veem, com a posição exata.')
    : `Equipe vê exato. O resto da cena vê ${precise ? 'a posição exata' : 'só a região (~500 m)'}${delay ? `, ${delay} min atrasado` : ', ao vivo'}.`;

  return (
    <Screen>
      <Title back>Quem vê meu carro</Title>
      <Pills options={MODES.map((m) => ({ value: m.value, label: m.label }))} value={mode} onChange={setMode} />
      <Body dim>{MODES.find((m) => m.value === mode)!.sub}</Body>

      {mode === 'crew' && myCrews.length > 1 && (
        <Card>
          <Label>Pra qual equipe?</Label>
          <Pills options={[{ value: '', label: 'Todas juntas' }, ...myCrews.map((c) => ({ value: c.id, label: c.name }))]}
                 value={onlyCrew} onChange={setOnlyCrew} />
        </Card>
      )}

      {mode === 'scene' && (
        <Card>
          <Label>Precisão pra quem não é da equipe</Label>
          <Pills options={[{ value: 0, label: 'Aproximada' }, { value: 1, label: 'Exata' }]}
                 value={precise ? 1 : 0} onChange={(v) => setPrecise(v === 1)} />
          <Label>Atraso da posição</Label>
          <Pills options={[{ value: 0, label: 'Ao vivo' }, { value: 2, label: '2 min' }, { value: 5, label: '5 min' }]}
                 value={delay} onChange={(v) => setDelay(v as Profile['delay_minutes'])} />
        </Card>
      )}

      <Card>
        <Label>Zonas privadas</Label>
        <Body dim>Dentro delas (raio de 1 km) você some do mapa até pra equipe. Ninguém vê onde o carro dorme.</Body>
        {zones.map((z) => (
          <Button key={z.id} title={`Remover zona: ${z.label}`} variant="secondary" onPress={() => removeZone(z.id)} />
        ))}
        <Button title="Marcar aqui como Casa" variant="secondary" onPress={() => addZone('Casa')} />
        <Button title="Marcar aqui como Trabalho" variant="secondary" onPress={() => addZone('Trabalho')} />
        <Body dim>Parou por 10 minutos, também some do mapa.</Body>
      </Card>

      <Card>
        <Mono>ASSIM OS OUTROS TE VEEM</Mono>
        <Body>{preview}</Body>
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title="Salvar" onPress={save} loading={busy} />
    </Screen>
  );
}

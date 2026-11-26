// Começar um comboio (fundador, admin ou staff): nome e destino. A equipe recebe o aviso e entra.
// Quem entra no comboio mostra a posição só pra quem está nele, enquanto ele durar.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Label, Screen, Title } from '../src/components/ui';
import { db } from '../src/lib/db';
import { friendlyError } from '../src/lib/errors.ts';
import { searchPlaces, type Place } from '../src/lib/routing';
import { lastKnownPosition } from '../src/lib/lastPosition';
import { colors } from '../src/theme/tokens.ts';

export default function ComboioNovo() {
  const router = useRouter();
  const { crew } = useLocalSearchParams<{ crew: string }>();
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (q.trim().length < 3) return;
    setSearching(true); setError(null);
    try { setResults(await searchPlaces(q.trim(), lastKnownPosition())); }
    catch { setError('Não consegui buscar esse endereço agora. Tenta de novo.'); }
    finally { setSearching(false); }
  }

  async function start() {
    if (!crew || !place) return;
    setBusy(true); setError(null);
    const { data, error: e } = await db.rpc('create_convoy', {
      p_crew: crew, p_title: title.trim(), p_dest_lat: place.lat, p_dest_lon: place.lon, p_dest_name: place.name.slice(0, 120),
    });
    setBusy(false);
    if (e) { setError(e.message.includes('too_many_convoys') ? 'Já tem 3 comboios abertos nessa equipe. Encerre um antes.' : friendlyError(e)); return; }
    router.replace({ pathname: '/comboio/[id]', params: { id: data as string } });
  }

  return (
    <Screen>
      <Title back="/equipes" sub="A equipe recebe o aviso e entra">Começar comboio</Title>
      <Field label="Nome do rolê" value={title} onChangeText={setTitle} maxLength={60} placeholder="Ex.: Rolê pro encontro de sábado" />

      <Label>Destino</Label>
      {place ? (
        <Card accent={colors.neon} style={{ gap: 6 }}>
          <Text style={{ color: colors.neon, fontWeight: '700' }}>{place.name}</Text>
          <Button title="Trocar destino" variant="secondary" onPress={() => setPlace(null)} />
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          <Field label="Endereço ou lugar" value={q} onChangeText={setQ} placeholder="Ex.: Posto Ipiranga Av. Brasil, Guarulhos"
                 returnKeyType="search" onSubmitEditing={search} />
          <Button title="Buscar" variant="secondary" onPress={search} disabled={q.trim().length < 3} />
          {searching && <ActivityIndicator color={colors.neon} />}
          {results.map((r) => (
            <Pressable key={r.id} accessibilityRole="button"
                       onPress={() => { setPlace({ name: `${r.name}${r.detail ? ` · ${r.detail}` : ''}`, lat: r.lat, lon: r.lon }); setResults([]); }}
                       style={({ pressed }) => ({ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line,
                                                  backgroundColor: pressed ? colors.panelAlt : colors.panel })}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{r.name}</Text>
              {!!r.detail && <Text style={{ color: colors.textDim, fontSize: 13 }}>{r.detail}</Text>}
            </Pressable>
          ))}
        </View>
      )}

      <Card style={{ gap: 4 }}>
        <Label>Como funciona</Label>
        <Body dim>Quem entra no comboio aparece pros outros do comboio no mapa (mesmo no modo fantasma), só enquanto ele durar. Zona privada continua escondida.</Body>
        <Body dim>O app avisa quando alguém ficou pra trás, pra galera esperar. Comboio é pra andar junto, não é corrida.</Body>
        <Body dim>Fecha sozinho depois de 12 horas.</Body>
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title="Começar comboio" onPress={start} loading={busy} disabled={title.trim().length < 2 || !place} />
    </Screen>
  );
}

// "Para onde?": busca o lugar (Photon/OpenStreetMap) e começa a navegação.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { searchPlaces, RoutingError, type Place } from '../src/lib/routing';
import { useNavigation } from '../src/lib/navigation';
import { lastKnownPosition } from '../src/lib/lastPosition';
import { routeErrorText } from '../src/lib/nav.ts';
import { colors, fonts, touch } from '../src/theme/tokens.ts';
import { goBack } from '../src/lib/goBack';

export default function Destino() {
  const router = useRouter();
  const nav = useNavigation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // busca enquanto digita (espera parar de digitar um pouco)
  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) { setResults([]); setError(null); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchPlaces(text, lastKnownPosition());
        if (my === seq.current) { setResults(found); setError(found.length ? null : 'Nada encontrado. Tente com o bairro ou a cidade.'); }
      } catch (e) {
        if (my === seq.current) setError(e instanceof RoutingError && e.message === 'sem_internet'
          ? 'Sem internet.' : routeErrorText(e instanceof RoutingError ? e.message : ''));
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [q]);

  const go = (p: Place) => {
    nav.start(p, lastKnownPosition());
    goBack(router);
  };

  const showRecents = q.trim().length < 3 && nav.recents.length > 0;
  const list = showRecents ? nav.recents : results;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TextInput
          style={s.input}
          value={q}
          onChangeText={setQ}
          placeholder="Para onde? Endereço, lugar, posto…"
          placeholderTextColor={colors.textMuted}
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Buscar destino"
        />
        <Pressable onPress={() => goBack(router)} style={s.cancel} accessibilityRole="button">
          <Text style={s.cancelText}>Cancelar</Text>
        </Pressable>
      </View>

      {showRecents && <Text style={s.section}>RECENTES</Text>}
      {loading && <ActivityIndicator color={colors.neon} style={{ marginTop: 16 }} />}
      {!!error && !loading && <Text style={s.error}>{error}</Text>}

      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable onPress={() => go(item)} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.panelAlt }]}
                     accessibilityRole="button" accessibilityLabel={`Ir para ${item.name}`}>
            <Text style={s.name} numberOfLines={1}>{item.name}</Text>
            {!!item.detail && <Text style={s.detail} numberOfLines={1}>{item.detail}</Text>}
          </Pressable>
        )}
      />
      <Text style={s.credit}>Busca e rotas: © colaboradores do OpenStreetMap</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 54 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  input: { flex: 1, minHeight: touch, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6, backgroundColor: colors.panel,
           color: colors.text, paddingHorizontal: 12, fontSize: 16 },
  cancel: { minHeight: touch, justifyContent: 'center' },
  cancelText: { color: colors.holo, fontSize: 15 },
  section: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, paddingHorizontal: 16, marginTop: 8 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, minHeight: touch },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  detail: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  error: { color: colors.textDim, paddingHorizontal: 16, marginTop: 16 },
  credit: { color: colors.textMuted, fontSize: 11, textAlign: 'center', padding: 12 },
});

// Ficha do carro pela tabela FIPE: marca -> modelo -> versão -> ano -> confirmar.
// Já abre no passo certo com o que a IA reconheceu na foto (marca/modelo), e a pessoa só confere.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './ui';
import {
  brandLabel, closestYear, groupFamilies, matchBrand, matchFamily, norm, versionLabel, yearLabel,
  type Family, type FipeItem, type FipeValor,
} from '../lib/fipe.ts';
import { fipeAnos, fipeMarcas, fipeModelos, fipeValor, RoutingError } from '../lib/routing';
import { colors, fonts } from '../theme/tokens.ts';

type Step = 'marca' | 'modelo' | 'versao' | 'ano' | 'ficha';
const TITLE: Record<Step, string> = { marca: 'Qual a marca?', modelo: 'Qual o modelo?', versao: 'Qual a versão?', ano: 'Ano do modelo', ficha: 'Confirme o carro' };

function errText(e: unknown): string {
  const code = e instanceof RoutingError ? e.message : '';
  if (code === 'sem_internet') return 'Sem internet agora. Tenta de novo.';
  if (code === 'fipe_ocupada' || code === 'muitas_buscas') return 'A tabela FIPE está ocupada. Tenta de novo em 1 minuto.';
  return 'Não consegui falar com a tabela FIPE agora. Tenta de novo.';
}

export function FipeSheet({ visible, hint, onClose, onPick }: {
  visible: boolean;
  hint?: { make?: string; model?: string; year?: number | null };
  onClose: () => void;
  onPick: (v: FipeValor, family: string) => void;
}) {
  const [step, setStep] = useState<Step>('marca');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<FipeItem[]>([]);
  const [brand, setBrand] = useState<FipeItem | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [family, setFamily] = useState<Family | null>(null);
  const [version, setVersion] = useState<FipeItem | null>(null);
  const [years, setYears] = useState<FipeItem[]>([]);
  const [value, setValue] = useState<FipeValor | null>(null);

  const run = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) { setError(errText(e)); return null; } finally { setBusy(false); }
  };

  async function openBrand(b: FipeItem, autoModel?: string) {
    setBrand(b); setQ('');
    const models = await run(() => fipeModelos(b.codigo));
    if (!models) return;
    const fam = groupFamilies(models);
    setFamilies(fam);
    const match = autoModel ? matchFamily(autoModel, fam) : null;
    if (match) openFamily(match); else setStep('modelo');
  }

  function openFamily(f: Family) {
    setFamily(f); setQ('');
    if (f.versions.length === 1) openVersion(f.versions[0], f); else setStep('versao');
  }

  async function openVersion(v: FipeItem, f = family) {
    if (!brand && !f) return;
    setVersion(v); setQ('');
    const ys = await run(() => fipeAnos(brandRef.current!.codigo, v.codigo));
    if (!ys) return;
    setYears(ys);
    const auto = hint?.year ? closestYear(ys, hint.year) : null;
    if (ys.length === 1) openYear(ys[0], v);
    else if (auto && hint?.year && auto.nome.startsWith(String(hint.year))) openYear(auto, v);
    else setStep('ano');
  }

  async function openYear(y: FipeItem, v = version) {
    if (!v) return;
    const val = await run(() => fipeValor(brandRef.current!.codigo, v.codigo, y.codigo));
    if (!val) return;
    setValue(val); setStep('ficha');
  }

  // a marca escolhida é usada dentro das funções async (estado pode estar atrasado)
  const brandRef = React.useRef<FipeItem | null>(null);
  brandRef.current = brand;

  // abriu: carrega marcas e tenta pular direto pro modelo que a IA reconheceu
  useEffect(() => {
    if (!visible) return;
    setStep('marca'); setQ(''); setError(null); setBrand(null); setFamily(null); setVersion(null); setValue(null);
    (async () => {
      const list = brands.length ? brands : await run(() => fipeMarcas());
      if (!list) return;
      setBrands(list);
      const b = hint?.make ? matchBrand(hint.make, list) : null;
      if (b) { brandRef.current = b; await openBrand(b, hint?.model); }
    })();
  }, [visible]);

  function back() {
    setQ(''); setError(null);
    if (step === 'ficha') setStep(years.length > 1 ? 'ano' : family && family.versions.length > 1 ? 'versao' : 'modelo');
    else if (step === 'ano') setStep(family && family.versions.length > 1 ? 'versao' : 'modelo');
    else if (step === 'versao') setStep('modelo');
    else if (step === 'modelo') setStep('marca');
    else onClose();
  }

  const list: { key: string; label: string; sub?: string; onPress: () => void }[] = useMemo(() => {
    const f = norm(q);
    const keep = (s: string) => !f || norm(s).includes(f);
    if (step === 'marca') return brands.filter((b) => keep(b.nome)).map((b) => ({ key: b.codigo, label: brandLabel(b.nome).toUpperCase(),
      onPress: () => { brandRef.current = b; openBrand(b); } }));
    if (step === 'modelo') return families.filter((x) => keep(x.name)).map((x) => ({ key: x.key, label: x.name,
      sub: `${x.versions.length} ${x.versions.length === 1 ? 'versão' : 'versões'}`, onPress: () => openFamily(x) }));
    if (step === 'versao' && family) return family.versions.filter((v) => keep(v.nome)).map((v) => ({ key: v.codigo,
      label: versionLabel(v.nome, family.name), onPress: () => openVersion(v) }));
    if (step === 'ano') return years.map((y) => ({ key: y.codigo, label: yearLabel(y.nome), onPress: () => openYear(y) }));
    return [];
  }, [step, q, brands, families, family, years]);

  const header = step === 'modelo' && brand ? brandLabel(brand.nome).toUpperCase()
    : step === 'versao' && family ? family.name
    : step === 'ano' && version && family ? versionLabel(version.nome, family.name) : TITLE[step];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={back}>
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <View style={s.top}>
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={10} style={s.backBtn}>
            <Text style={s.backTxt}>‹</Text>
          </Pressable>
          <Text style={s.title} numberOfLines={1} accessibilityRole="header">{header}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>Fechar</Text>
          </Pressable>
        </View>

        {step !== 'ficha' && step !== 'ano' && (
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar…" placeholderTextColor={colors.textMuted}
                     style={s.search} autoCorrect={false} accessibilityLabel="Buscar" />
        )}
        {error && <Text style={s.error}>{error}</Text>}
        {busy && <ActivityIndicator color={colors.neon} style={{ marginVertical: 16 }} />}

        {step === 'ficha' && value && family ? (
          <View style={{ padding: 20, gap: 16 }}>
            <View style={s.card}>
              {[
                ['Marca', brandLabel(value.marca).toUpperCase()],
                ['Modelo', family.name],
                ['Ano', value.ano >= 1950 && value.ano <= 2100 ? String(value.ano) : 'Zero km'],
                ['Versão', versionLabel(value.modelo, family.name)],
              ].map(([k, v]) => <Row key={k} k={k} v={v} />)}
              <View style={s.sep} />
              <Row k="Código FIPE" v={value.codigo_fipe} />
              <Row k="Combustível" v={value.combustivel} />
              <Row k="Preço FIPE" v={value.valor} strong />
              <Text style={s.ref}>Ref.: {value.referencia}</Text>
            </View>
            <Button title="Usar esta ficha no meu carro" onPress={() => onPick(value, family.name)} />
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
              Dados da tabela FIPE (preço médio de mercado). Ajuda a galera a saber exatamente qual é o seu carro.
            </Text>
          </View>
        ) : (
          <FlatList data={list} keyExtractor={(i) => i.key} keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 24 }}
                    renderItem={({ item }) => (
                      <Pressable onPress={item.onPress} accessibilityRole="button" disabled={busy}
                                 style={({ pressed }) => [s.item, pressed && { backgroundColor: colors.panel }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemTxt}>{item.label}</Text>
                          {item.sub ? <Text style={s.itemSub}>{item.sub}</Text> : null}
                        </View>
                        <Text style={s.chev}>›</Text>
                      </Pressable>
                    )}
                    ListEmptyComponent={!busy ? <Text style={[s.itemSub, { padding: 20 }]}>Nada encontrado.</Text> : null} />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.k}>{k}</Text>
      <Text style={[s.v, strong && { color: colors.neon, fontWeight: '800' }]} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, width: '100%', maxWidth: 640, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8,
         borderBottomWidth: 1, borderBottomColor: colors.line },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center',
             justifyContent: 'center', backgroundColor: colors.panel },
  backTxt: { color: colors.holo, fontSize: 24, lineHeight: 26, marginTop: -2 },
  title: { flex: 1, color: colors.text, fontFamily: fonts.display, fontWeight: '800', letterSpacing: -0.3, fontSize: 22 },
  search: { margin: 16, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel,
            color: colors.text, paddingHorizontal: 14, fontSize: 16 },
  error: { color: colors.danger, paddingHorizontal: 16, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.line },
  itemTxt: { color: colors.text, fontSize: 16 },
  itemSub: { color: colors.textMuted, fontSize: 13 },
  chev: { color: colors.textMuted, fontSize: 22 },
  card: { backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  k: { color: colors.textMuted, fontSize: 15 },
  v: { color: colors.text, fontSize: 15, flexShrink: 1, textAlign: 'right' },
  sep: { height: 1, backgroundColor: colors.line, marginVertical: 2 },
  ref: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 12 },
});

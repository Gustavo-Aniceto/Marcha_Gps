// Filtro do mapa: escolhe quais carros e quais avisos aparecem. Fica salvo no aparelho.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportIcon } from './ReportIcon';
import { Pills } from './ui';
import { DEFAULT_FILTER, GROUPS, activeCount, type CarsShown, type MapFilter } from '../lib/mapFilter.ts';
import { colors } from '../theme/tokens.ts';

export function MapFilterSheet({ visible, filter, onChange, onClose }: {
  visible: boolean; filter: MapFilter; onChange: (f: MapFilter) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const n = activeCount(filter);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Fechar filtro" />
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} accessibilityViewIsModal>
        <View style={s.grab} />
        <View style={s.head}>
          <Text style={s.title} accessibilityRole="header">Filtrar o mapa</Text>
          {n > 0 && (
            <Pressable onPress={() => onChange(DEFAULT_FILTER)} accessibilityRole="button" hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: colors.holo, fontWeight: '700' }}>Mostrar tudo</Text>
            </Pressable>
          )}
        </View>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
          <Text style={s.label}>CARROS</Text>
          <Pills<CarsShown>
            options={[{ value: 'todos', label: 'Todos' }, { value: 'equipe', label: 'Só minhas equipes' }, { value: 'nenhum', label: 'Nenhum' }]}
            value={filter.cars} onChange={(cars) => onChange({ ...filter, cars })} />

          <Text style={[s.label, { marginTop: 6 }]}>AVISOS NO MAPA</Text>
          <View style={s.card}>
            {GROUPS.map((g, i) => (
              <View key={g.id} style={[s.row, i > 0 && s.rowLine]}>
                <ReportIcon kind={g.kinds[0]} size={30} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{g.label}</Text>
                  <Text style={s.rowSub}>{g.sub}</Text>
                </View>
                <Switch value={filter.groups[g.id]} accessibilityLabel={`Mostrar ${g.label}`}
                        onValueChange={(v) => onChange({ ...filter, groups: { ...filter.groups, [g.id]: v } })}
                        trackColor={{ true: colors.neon, false: colors.lineStrong }} thumbColor={filter.groups[g.id] ? colors.bg : colors.textDim} />
              </View>
            ))}
          </View>
          <View style={[s.card, s.row]}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Só os confirmados</Text>
              <Text style={s.rowSub}>Esconde os avisos que ninguém confirmou ainda</Text>
            </View>
            <Switch value={filter.onlyConfirmed} accessibilityLabel="Só os confirmados"
                    onValueChange={(v) => onChange({ ...filter, onlyConfirmed: v })}
                    trackColor={{ true: colors.neon, false: colors.lineStrong }} thumbColor={filter.onlyConfirmed ? colors.bg : colors.textDim} />
          </View>
          <Text style={s.note}>
            O filtro só limpa o mapa. Navegando, o aviso de radar e de obstáculo que pega no seu carro continua tocando.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '86%', backgroundColor: colors.bg,
           borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: colors.line,
           paddingHorizontal: 18, paddingTop: 8, width: '100%', maxWidth: 640, alignSelf: 'center' },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  card: { backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 12 },
  note: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});

// "Com qual carro você vai sair?" — aparece no mapa ao abrir o app, só pra quem tem mais de um carro.
// Uma vez por abertura do app; a escolha vira o carro do mapa (set_active_car).
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CarMarker } from './CarMarker';
import { db } from '../lib/db';
import { friendlyError } from '../lib/errors.ts';
import { colors, fonts } from '../theme/tokens.ts';

interface Car { id: string; make: string; model: string; color: string; body_type: string; tint: string; spoiler: boolean;
                neon: string | null; is_active: boolean }

let askedThisOpen = false; // zera quando o app é aberto de novo

export function CarChooser({ ownerId, onChosen }: { ownerId: string | null | undefined; onChosen: () => void }) {
  const [cars, setCars] = useState<Car[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId || askedThisOpen) return;
    db.from('cars').select('id, make, model, color, body_type, tint, spoiler, neon, is_active').eq('owner_id', ownerId)
      .order('is_active', { ascending: false }).order('updated_at', { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Car[];
        if (list.length > 1 && !askedThisOpen) { askedThisOpen = true; setCars(list); setOpen(true); }
      });
  }, [ownerId]);

  async function pick(c: Car) {
    setError(null);
    if (c.is_active) { setOpen(false); return; }
    setBusy(c.id);
    const { error: e } = await db.rpc('set_active_car', { p_car: c.id });
    setBusy(null);
    if (e) { setError(friendlyError(e)); return; }
    setOpen(false);
    onChosen();
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={s.backdrop}>
        <View style={s.sheet} accessibilityViewIsModal>
          <Text style={s.title} accessibilityRole="header">Com qual carro você vai sair?</Text>
          <Text style={s.sub}>É ele que a galera vai ver no mapa e na Cena.</Text>
          <ScrollView contentContainerStyle={{ gap: 8 }} style={{ maxHeight: 420 }}>
            {cars.map((c) => (
              <Pressable key={c.id} onPress={() => pick(c)} disabled={!!busy} accessibilityRole="button"
                         accessibilityLabel={`${c.make} ${c.model}${c.is_active ? ', é o do mapa agora' : ''}`}
                         style={[s.row, c.is_active && { borderColor: colors.neon }]}>
                <CarMarker color={c.color} neon={c.neon} heading={0} body={c.body_type} tint={c.tint} spoiler={c.spoiler} size={56} />
                <View style={{ flex: 1 }}>
                  <Text style={s.car}>{c.make} {c.model}</Text>
                  {c.is_active && <Text style={s.mono}>ÚLTIMO USADO</Text>}
                </View>
                <Text style={{ color: colors.neon, fontSize: 20 }}>{busy === c.id ? '…' : '›'}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.panel, borderRadius: 14, borderWidth: 1, borderColor: colors.lineStrong, padding: 16, gap: 10,
           maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 64, borderRadius: 10, borderWidth: 1.5,
         borderColor: colors.line, backgroundColor: colors.panelAlt },
  car: { color: colors.text, fontSize: 16, fontWeight: '700' },
  mono: { color: colors.neon, fontFamily: fonts.mono, fontSize: 11 },
});

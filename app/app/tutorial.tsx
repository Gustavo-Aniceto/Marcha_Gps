// Tutorial do primeiro acesso (e "Como usar o app" no menu ☰ do mapa).
// Telas curtas, uma função por vez; arrastar pro lado ou tocar em Próximo. Dá pra pular.
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../src/components/ui';
import { goBack } from '../src/lib/goBack';
import { nextStep, TUTORIAL, TUTORIAL_KEY, type TutorialStep } from '../src/lib/tutorial.ts';
import { chrome, colors, fonts } from '../src/theme/tokens.ts';

const TONE: Record<TutorialStep['tone'], string> = {
  neon: colors.neon, report: chrome.report, warn: colors.warn, route: colors.route,
};

export default function Tutorial() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pageW = Math.min(width, 560);
  const [i, setI] = useState(0);
  const [pageH, setPageH] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const step = TUTORIAL[i];
  const tone = TONE[step.tone];
  const last = nextStep(i) == null;

  async function finish() {
    try { await AsyncStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* sem armazenamento: mostra de novo depois */ }
    goBack(router);
  }

  function go(n: number) {
    setI(n);
    scroller.current?.scrollTo({ x: n * pageW, animated: true });
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={[s.top, { width: pageW }]}>
        <Text style={s.count}>{i + 1} de {TUTORIAL.length}</Text>
        {!last && (
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={12} style={s.skip}>
            <Text style={s.skipText}>Pular</Text>
          </Pressable>
        )}
      </View>

      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                  style={{ width: pageW, flex: 1 }} scrollEventThrottle={32}
                  onLayout={(e) => setPageH(e.nativeEvent.layout.height)}
                  onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / pageW))}
                  onScroll={(e) => { const n = Math.round(e.nativeEvent.contentOffset.x / pageW); if (n !== i) setI(n); }}>
        {TUTORIAL.map((t) => (
          <View key={t.id} style={[s.page, { width: pageW, height: pageH || undefined }]} accessibilityLabel={`${t.title}. ${t.text}`}>
            <View style={[s.art, { borderColor: TONE[t.tone] }]}>
              <Svg width={72} height={72} viewBox="0 0 24 24" fill="none" stroke={TONE[t.tone]} strokeWidth={1.6}
                   strokeLinecap="round" strokeLinejoin="round">
                <Path d={t.icon} />
              </Svg>
            </View>
            <Text style={[s.where, { color: TONE[t.tone] }]}>{t.where.toUpperCase()}</Text>
            <Text style={s.title} accessibilityRole="header">{t.title}</Text>
            <Text style={s.text}>{t.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[s.bottom, { width: pageW }]}>
        <View style={s.dots} accessibilityRole="adjustable" accessibilityLabel={`Passo ${i + 1} de ${TUTORIAL.length}`}>
          {TUTORIAL.map((t, n) => (
            <Pressable key={t.id} onPress={() => go(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Ir pro passo ${n + 1}`}>
              <View style={[s.dot, n === i && { width: 22, backgroundColor: tone }]} />
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {i > 0 && (
            <View style={{ flex: 1 }}>
              <Button title="Voltar" variant="secondary" color={colors.holo} onPress={() => go(i - 1)} />
            </View>
          )}
          <View style={{ flex: 2 }}>
            <Button title={last ? 'Começar' : 'Próximo'} color={tone} onPress={() => (last ? finish() : go(i + 1))} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 52 },
  count: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1 },
  skip: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { color: colors.holo, fontSize: 16, fontWeight: '600' },
  page: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 14 },
  art: { width: 132, height: 132, borderRadius: 66, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
         backgroundColor: colors.panel, marginBottom: 12 },
  where: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  text: { color: colors.textDim, fontSize: 17, lineHeight: 25 },
  bottom: { paddingHorizontal: 20, paddingBottom: 12, gap: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, minHeight: 24, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
});

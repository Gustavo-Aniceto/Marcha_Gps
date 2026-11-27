// Peças visuais da equipe: capa (foto ou fundo na cor da equipe com o nome apagado), esmaecido no pé da capa
// e foto redonda (logo ou inicial). Usadas no Descobrir e na página da equipe.
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/tokens.ts';

// Escurece o pé da capa pra o texto e a logo ficarem legíveis (sem biblioteca de degradê).
export function BottomFade({ height = 70 }: { height?: number }) {
  const steps = [0.08, 0.18, 0.32, 0.5, 0.7];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}>
      {steps.map((o, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: colors.bg, opacity: o }} />
      ))}
    </View>
  );
}

export function CrewCover({ name, color, accent, uri, height, fontSize = 50 }:
  { name: string; color: string; accent: string; uri: string | null; height: number; fontSize?: number }) {
  return (
    <View style={{ height, backgroundColor: colors.panelAlt, overflow: 'hidden' }}>
      {uri
        ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`Capa da equipe ${name}`} />
        : (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', overflow: 'hidden' }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.22 }]} />
            {/* listras na diagonal, no clima de faixa de carro */}
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ position: 'absolute', right: 30 + i * 34, top: -40, width: 16, height: height + 80,
                                     backgroundColor: accent, opacity: 0.1, transform: [{ rotate: '20deg' }] }} />
            ))}
            <Text numberOfLines={1} style={{ width: 1600, color: accent, opacity: 0.2, fontSize, fontWeight: '900', marginLeft: 12,
                                             letterSpacing: -1, transform: [{ rotate: '-6deg' }] }}>{name.toUpperCase()}</Text>
          </View>
        )}
      <BottomFade height={Math.round(height * 0.45)} />
    </View>
  );
}

export function CrewLogo({ name, accent, uri, size }: { name: string; accent: string; uri: string | null; size: number }) {
  const ring = { width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: accent };
  return uri
    ? <Image source={{ uri }} style={[ring, { backgroundColor: colors.panel }]} accessibilityLabel={`Foto da equipe ${name}`} />
    : (
      <View style={[ring, { backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: accent, fontSize: size * 0.42, fontWeight: '800' }}>{(name[0] ?? '?').toUpperCase()}</Text>
      </View>
    );
}

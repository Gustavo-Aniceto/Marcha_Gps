// No app nativo (por enquanto) o carro da garagem é o desenho de cima; o 3D fica no navegador (Car3D.web.tsx).
import React from 'react';
import { View } from 'react-native';
import type { CarSpec } from '../lib/car3dTypes';
import { CarMarker } from './CarMarker';

export function Car3DView({ spec, width = 300, height = 220 }:
  { spec: CarSpec; width?: number; height?: number; pitch?: number; autoRotate?: boolean }) {
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <CarMarker color={spec.color ?? undefined} neon={spec.neon} heading={0} body={spec.body} tint={spec.tint}
                 spoiler={spec.spoiler} size={Math.min(width, height) * 0.8} />
    </View>
  );
}

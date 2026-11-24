// Velocímetro do mapa: sua velocidade agora e, se tiver radar à frente, a placa com o limite.
// Fica vermelho quando passa do limite. Nada disso é guardado.
import React from 'react';
import { Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens.ts';
import { SpeedSign } from './SpeedSign';

export function Speedometer({ kmh, limit, over, radarDist }: {
  kmh: number | null; limit?: number | null; over?: boolean; radarDist?: number | null;
}) {
  const value = kmh == null ? '--' : String(Math.round(kmh));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite"
          accessibilityLabel={`Sua velocidade: ${kmh == null ? 'sem sinal' : `${Math.round(kmh)} km/h`}${limit ? `. Radar de ${limit} à frente` : ''}${over ? '. Acima do limite' : ''}`}>
      <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 3,
                     borderColor: over ? colors.danger : colors.lineStrong,
                     backgroundColor: over ? colors.danger : 'rgba(6,12,22,0.94)',
                     alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: over ? colors.ink : colors.text, fontFamily: fonts.display, fontSize: 26, lineHeight: 28 }}>{value}</Text>
        <Text style={{ color: over ? colors.ink : colors.textMuted, fontFamily: fonts.mono, fontSize: 10 }}>km/h</Text>
      </View>
      {limit ? (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <SpeedSign limit={limit} size={44} />
          {radarDist != null && (
            <Text style={{ color: colors.text, fontFamily: fonts.mono, fontSize: 10, backgroundColor: 'rgba(6,12,22,0.88)', paddingHorizontal: 4 }}>
              {radarDist < 1000 ? `${Math.round(radarDist / 10) * 10} m` : `${(radarDist / 1000).toFixed(1)} km`}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

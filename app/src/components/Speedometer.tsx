// Velocímetro do mapa: sua velocidade agora e, se tiver radar à frente, a placa com o limite.
// Fica vermelho quando passa do limite. Nada disso é guardado.
import React from 'react';
import { Text, View } from 'react-native';
import { chrome, colors, fonts, type ChromeTheme } from '../theme/tokens.ts';
import { SpeedSign } from './SpeedSign';

export function Speedometer({ kmh, limit, over, radarDist, theme = chrome.noite }: {
  kmh: number | null; limit?: number | null; over?: boolean; radarDist?: number | null; theme?: ChromeTheme;
}) {
  const value = kmh == null ? '--' : String(Math.round(kmh));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessibilityLiveRegion="polite"
          accessibilityLabel={`Sua velocidade: ${kmh == null ? 'sem sinal' : `${Math.round(kmh)} km/h`}${limit ? `. Radar de ${limit} à frente` : ''}${over ? '. Acima do limite' : ''}`}>
      <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3,
                     borderColor: over ? colors.danger : theme.border,
                     backgroundColor: over ? colors.danger : theme.panel,
                     alignItems: 'center', justifyContent: 'center',
                     shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
        <Text style={{ color: over ? '#FFFFFF' : theme.text, fontSize: 25, fontWeight: '800', lineHeight: 27 }}>{value}</Text>
        <Text style={{ color: over ? '#FFFFFF' : theme.sub, fontSize: 10, fontWeight: '600' }}>km/h</Text>
      </View>
      {limit ? (
        <View style={{ alignItems: 'center', gap: 2, marginLeft: -8, marginBottom: 30 }}>
          <SpeedSign limit={limit} size={36} />
          {radarDist != null && (
            <Text style={{ color: theme.text, fontFamily: fonts.mono, fontSize: 10, backgroundColor: theme.panel,
                           paddingHorizontal: 4, borderRadius: 3, overflow: 'hidden' }}>
              {radarDist < 1000 ? `${Math.round(radarDist / 10) * 10} m` : `${(radarDist / 1000).toFixed(1)} km`}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

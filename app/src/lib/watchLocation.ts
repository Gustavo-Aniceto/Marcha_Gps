// GPS no app nativo (expo-location). A versão do navegador está em watchLocation.web.ts.
import * as Location from 'expo-location';

export interface RawFix { lat: number; lon: number; heading: number | null; accuracy: number | null; speed: number | null }
export type LocError = 'negado' | 'indisponivel' | 'demorou';

export async function startWatch(fast: boolean, onFix: (f: RawFix) => void, onError: (e: LocError) => void): Promise<() => void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') { onError('negado'); return () => {}; }
  // primeira posição rápida (a última conhecida), pra já centralizar o mapa
  Location.getLastKnownPositionAsync().then((l) => { if (l) onFix(toFix(l)); }).catch(() => {});
  const sub = await Location.watchPositionAsync(
    fast
      ? { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 }
      : { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
    (l) => onFix(toFix(l)),
  );
  return () => sub.remove();
}

function toFix(l: Location.LocationObject): RawFix {
  return {
    lat: l.coords.latitude, lon: l.coords.longitude,
    heading: l.coords.heading != null && l.coords.heading >= 0 ? l.coords.heading : null,
    accuracy: l.coords.accuracy ?? null,
    speed: l.coords.speed != null && l.coords.speed >= 0 ? l.coords.speed : null,
  };
}

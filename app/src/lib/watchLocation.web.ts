// GPS no navegador: usa direto a localização do navegador (mais confiável que a camada do expo-location na web).
// Primeiro pega uma posição rápida (pode ser aproximada) pra centralizar o mapa; depois segue com GPS preciso.
export interface RawFix { lat: number; lon: number; heading: number | null; accuracy: number | null; speed: number | null }
export type LocError = 'negado' | 'indisponivel' | 'demorou';

export async function startWatch(fast: boolean, onFix: (f: RawFix) => void, onError: (e: LocError) => void): Promise<() => void> {
  const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
  if (!geo) { onError('indisponivel'); return () => {}; }

  const toFix = (p: GeolocationPosition): RawFix => ({
    lat: p.coords.latitude, lon: p.coords.longitude,
    heading: p.coords.heading != null && !Number.isNaN(p.coords.heading) && p.coords.heading >= 0 ? p.coords.heading : null,
    accuracy: p.coords.accuracy ?? null,
    speed: p.coords.speed != null && !Number.isNaN(p.coords.speed) && p.coords.speed >= 0 ? p.coords.speed : null,
  });
  const fail = (e: GeolocationPositionError) => {
    onError(e.code === e.PERMISSION_DENIED ? 'negado' : e.code === e.TIMEOUT ? 'demorou' : 'indisponivel');
  };

  let gotPrecise = false;
  geo.getCurrentPosition((p) => { if (!gotPrecise) onFix(toFix(p)); }, () => {},
    { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 });

  const id = geo.watchPosition(
    (p) => { gotPrecise = true; onFix(toFix(p)); },
    fail,
    { enableHighAccuracy: true, maximumAge: fast ? 1000 : 5000, timeout: 30_000 },
  );
  return () => geo.clearWatch(id);
}

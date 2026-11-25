// Câmera do mapa: o usuário escolhe 3D/2D, ângulo e raio de visão do trajeto.

export type MapThemeSetting = 'auto' | 'noite' | 'dia';

export interface MapCameraSettings {
  theme: MapThemeSetting; // visual do mapa de navegação (a Cena ao vivo é sempre 2D escuro); 'auto' segue o sol
  threeD: boolean;
  pitch: number; // 20 a 88 graus
  radiusM: number; // 40 a 220 m à frente
}

export const DEFAULT_CAMERA: MapCameraSettings = { theme: 'auto', threeD: true, pitch: 50, radiusM: 110 };

export const PITCH_PRESETS = [
  { label: 'Atrás', pitch: 28 },
  { label: 'Alto', pitch: 55 },
  { label: 'Drone', pitch: 82 },
] as const;

export const RADIUS_OPTIONS = [40, 80, 110, 160, 220] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Converte as preferências em pitch/zoom do mapa (MapLibre). Raio maior = mais afastado. */
export function cameraFor(s: MapCameraSettings): { pitch: number; zoom: number } {
  const radius = clamp(s.radiusM, 40, 220);
  const zoom = 18.5 - 1.25 * Math.log2(radius / 40);
  return { pitch: s.threeD ? clamp(s.pitch, 20, 88) : 0, zoom: Math.round(zoom * 100) / 100 };
}

// ---------- tema automático: dia claro do nascer ao pôr do sol ----------

const RAD = Math.PI / 180;
const SP = { lat: -23.55, lon: -46.63 };

/** Nascer e pôr do sol (algoritmo do NOAA, erro de ~1 min) no dia de `date`, em UTC. */
export function sunTimes(date: Date, lat = SP.lat, lon = SP.lon): { sunrise: Date; sunset: Date } | null {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const n = Math.floor((day - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
  const g = (2 * Math.PI / 365) * (n - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
  if (cosH < -1 || cosH > 1) return null; // sol da meia-noite / noite polar
  const ha = Math.acos(cosH) / RAD;
  const rise = 720 - 4 * (lon + ha) - eqTime;   // minutos UTC
  const set = 720 - 4 * (lon - ha) - eqTime;
  return { sunrise: new Date(day + rise * 60_000), sunset: new Date(day + set * 60_000) };
}

/** 'auto' vira 'dia' entre o nascer e o pôr do sol de onde a pessoa está (São Paulo se não souber). */
export function resolveTheme(setting: MapThemeSetting, now: Date, pos?: { lat: number; lon: number } | null): 'noite' | 'dia' {
  if (setting !== 'auto') return setting;
  const t = sunTimes(now, pos?.lat ?? SP.lat, pos?.lon ?? SP.lon);
  if (!t) return 'noite';
  return now >= t.sunrise && now < t.sunset ? 'dia' : 'noite';
}

// ---------- zoom da navegação pela velocidade (como nos apps de trânsito) ----------

/**
 * Mais rápido = mapa mais afastado pra ver mais longe. Chegando numa conversão devagar, aproxima um pouco.
 * Arredonda em 0,1 pra câmera não ficar "respirando" com cada leitura.
 */
export function navZoom(base: number, kmh: number | null, nextManeuverM: number | null): number {
  const v = kmh ?? 0;
  let z = base;
  if (v > 25) z -= Math.min(1.6, ((v - 25) / 65) * 1.6);   // até -1,6 a partir de 90 km/h
  if (nextManeuverM != null && nextManeuverM < 120 && v < 60) z = Math.max(z, base) + 0.4;
  return Math.round(z * 10) / 10;
}

// ---------- sinal do GPS ----------

export type GpsQuality = 'bom' | 'fraco' | 'perdido';

/** fraco: precisão pior que 50 m; perdido: nenhuma leitura há mais de 15 s. */
export function gpsQuality(accuracyM: number | null, ageMs: number): GpsQuality {
  if (ageMs > 15_000) return 'perdido';
  if (accuracyM != null && accuracyM > 50) return 'fraco';
  return 'bom';
}

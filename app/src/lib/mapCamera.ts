// Câmera do mapa: o usuário escolhe 3D/2D, ângulo e raio de visão do trajeto.

export interface MapCameraSettings {
  theme: 'noite' | 'dia'; // visual do mapa de navegação (a Cena ao vivo é sempre 2D escuro)
  threeD: boolean;
  pitch: number; // 20 a 88 graus
  radiusM: number; // 40 a 220 m à frente
}

export const DEFAULT_CAMERA: MapCameraSettings = { theme: 'noite', threeD: true, pitch: 50, radiusM: 110 };

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

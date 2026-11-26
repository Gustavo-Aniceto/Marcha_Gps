// Medidas do carro em 3D (em metros), por tipo de carroceria. Lógica pura, sem three.js,
// pra dar pra testar: o desenho do perfil (de lado) com os arcos das rodas, vidros e eixos.
import type { BodyType } from './carBodies.ts';

export interface Profile3D {
  L: number; W: number;          // comprimento e largura
  tailY: number;                 // altura da traseira (tampa/porta-malas/caçamba)
  rearGlassX: number;            // onde começa o vidro de trás
  roofRearX: number; roofFrontX: number; roofY: number;
  cowlX: number; cowlY: number;  // base do para-brisa
  noseTopY: number;              // altura do capô na frente
  bedEndX?: number;              // picape: fim da caçamba (encosta na cabine)
  frontAxle: number; rearAxle: number; // posição dos eixos (x)
  baseClearance: number;         // vão original (m)
}

// x negativo = traseira, positivo = frente; y a partir do fundo da carroceria
export const PROFILES: Record<BodyType, Profile3D> = {
  hatch: { L: 3.95, W: 1.70, tailY: 0.80, rearGlassX: -1.82, roofRearX: -1.50, roofFrontX: 0.10, roofY: 1.22,
           cowlX: 0.92, cowlY: 0.80, noseTopY: 0.66, frontAxle: 1.22, rearAxle: -1.22, baseClearance: 0.16 },
  seda: { L: 4.45, W: 1.72, tailY: 0.80, rearGlassX: -1.45, roofRearX: -0.98, roofFrontX: 0.30, roofY: 1.22,
          cowlX: 1.12, cowlY: 0.80, noseTopY: 0.66, frontAxle: 1.38, rearAxle: -1.32, baseClearance: 0.16 },
  perua: { L: 4.45, W: 1.72, tailY: 0.82, rearGlassX: -2.12, roofRearX: -1.98, roofFrontX: 0.25, roofY: 1.26,
           cowlX: 1.10, cowlY: 0.80, noseTopY: 0.66, frontAxle: 1.38, rearAxle: -1.32, baseClearance: 0.16 },
  picape: { L: 4.45, W: 1.72, tailY: 0.82, rearGlassX: -0.48, roofRearX: -0.42, roofFrontX: 0.32, roofY: 1.24,
            cowlX: 1.10, cowlY: 0.82, noseTopY: 0.68, bedEndX: -0.52, frontAxle: 1.40, rearAxle: -1.30, baseClearance: 0.18 },
  picape_grande: { L: 5.25, W: 1.88, tailY: 1.02, rearGlassX: -0.62, roofRearX: -0.55, roofFrontX: 0.55, roofY: 1.58,
                   cowlX: 1.38, cowlY: 1.05, noseTopY: 0.98, bedEndX: -0.68, frontAxle: 1.68, rearAxle: -1.52, baseClearance: 0.26 },
  suv: { L: 4.30, W: 1.80, tailY: 0.95, rearGlassX: -2.06, roofRearX: -1.88, roofFrontX: 0.30, roofY: 1.48,
         cowlX: 1.05, cowlY: 0.97, noseTopY: 0.85, frontAxle: 1.32, rearAxle: -1.30, baseClearance: 0.22 },
  esportivo: { L: 4.30, W: 1.80, tailY: 0.70, rearGlassX: -1.55, roofRearX: -0.78, roofFrontX: 0.18, roofY: 1.04,
               cowlX: 1.00, cowlY: 0.70, noseTopY: 0.52, frontAxle: 1.35, rearAxle: -1.30, baseClearance: 0.13 },
  van: { L: 4.60, W: 1.85, tailY: 1.05, rearGlassX: -2.27, roofRearX: -2.24, roofFrontX: 1.55, roofY: 1.78,
         cowlX: 2.05, cowlY: 1.02, noseTopY: 0.95, frontAxle: 1.70, rearAxle: -1.45, baseClearance: 0.18 },
};

export function profileFor(body: string | null | undefined): Profile3D {
  return PROFILES[(body ?? 'hatch') as BodyType] ?? PROFILES.hatch;
}

/** Raio da roda com pneu (m) pelo aro. */
export function wheelRadius(rim: number | null | undefined): number {
  const r = Math.min(Math.max(rim ?? 15, 13), 22);
  return (r * 0.0254) / 2 + 0.12;
}

/** Vão (fundo da carroceria até o chão) pela altura da garagem: rebaixado chega bem perto. */
export function clearance(p: Profile3D, rideHeightCm: number | null | undefined): number {
  const cm = rideHeightCm ?? 15;
  return Math.max(0.05, p.baseClearance * (cm / 15));
}

/** Ponto da roda pra fora/alinhada/pra dentro (z do centro do pneu). */
export function wheelZ(p: Profile3D, position: string | null | undefined): number {
  const base = p.W / 2 - 0.13;
  return base + (position === 'fora' ? 0.05 : position === 'dentro' ? -0.04 : 0);
}

/** Contorno de lado (sentido anti-horário a partir da frente embaixo), sem os arcos das rodas. */
export function silhouette(p: Profile3D): [number, number][] {
  const h = p.L / 2;
  const pts: [number, number][] = [[h, 0.12], [h, p.noseTopY - 0.2], [h - 0.12, p.noseTopY], [p.cowlX, p.cowlY],
    [p.roofFrontX, p.roofY], [p.roofRearX, p.roofY]];
  if (p.bedEndX != null) {
    // cabine de picape: traseira da cabine reta e a caçamba na altura da tampa
    pts.push([p.rearGlassX, p.roofY - 0.04], [p.bedEndX, p.tailY + 0.02], [p.bedEndX, p.tailY], [-h + 0.04, p.tailY]);
  } else {
    pts.push([p.rearGlassX, p.tailY + 0.02], [-h + 0.08, p.tailY]);
  }
  pts.push([-h, p.tailY - 0.12], [-h, 0.12]);
  return pts;
}

/** Onde o arco da roda corta o fundo da carroceria (x à direita e à esquerda), ou null se não corta. */
export function archSpan(axleX: number, wheelCenterY: number, archR: number): [number, number] | null {
  if (wheelCenterY >= archR) return null;
  const dx = Math.sqrt(archR * archR - wheelCenterY * wheelCenterY);
  return [axleX + dx, axleX - dx];
}

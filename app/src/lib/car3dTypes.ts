// Como descrever o carro pro desenho 3D (sem depender do three.js, pra o app nativo também usar).
export interface CarSpec {
  color?: string | null; body?: string | null; tint?: string | null; spoiler?: boolean | null; neon?: string | null;
  rim?: number | null; rideHeight?: number | null; camber?: number | null; wheelPosition?: string | null;
  me?: boolean;
}

/** Carro do banco (cars) -> CarSpec. */
export function specFromCar(c: {
  color?: string | null; body_type?: string | null; tint?: string | null; spoiler?: boolean | null; neon?: string | null;
  rim?: number | null; ride_height_cm?: number | null; camber_deg?: number | string | null; wheel_position?: string | null;
} | null | undefined, me = false): CarSpec {
  return {
    color: c?.color ?? '#B9C0CB', body: c?.body_type ?? 'hatch', tint: c?.tint ?? 'nenhuma', spoiler: !!c?.spoiler, neon: c?.neon ?? null,
    rim: c?.rim ?? 15, rideHeight: c?.ride_height_cm ?? 15, camber: c?.camber_deg != null ? Number(c.camber_deg) : 0,
    wheelPosition: c?.wheel_position ?? 'alinhada', me,
  };
}

// Regras da garagem: o que encosta, que pneu vai, e se o obstáculo raspa no carro.

export type WheelPosition = 'dentro' | 'alinhada' | 'fora';
export type Suspension = 'original' | 'fixa' | 'rosca' | 'ar';

export interface CarSetup {
  rim: number; // aro, 13 a 22
  rideHeightCm: number; // vão livre
  wheelPosition: WheelPosition;
  camberDeg: number;
  suspension: Suspension;
}

export interface FitmentResult {
  ok: boolean;
  warnings: string[];
}

const TIRES: Record<number, string> = {
  13: '165/70 R13', 14: '175/65 R14', 15: '185/55 R15', 16: '195/50 R16',
  17: '205/40 R17', 18: '215/35 R18', 19: '225/35 R19', 20: '225/30 R20',
  21: '245/30 R21', 22: '255/30 R22',
};

export function tireFor(rim: number): string | null {
  return TIRES[rim] ?? null;
}

export const LOW_CM = 8;

export function checkFitment(car: CarSetup): FitmentResult {
  const warnings: string[] = [];
  const low = car.rideHeightCm <= LOW_CM;
  if (car.rim >= 19 && low) {
    warnings.push(`Aro ${car.rim} com carro baixo: o pneu pega no para-lama. Precisa puxar a lata ou subir um pouco.`);
  }
  if (car.wheelPosition === 'fora' && low) {
    warnings.push('Roda pra fora com carro baixo raspa a borda do para-lama nas curvas.');
  }
  if (car.camberDeg >= 5) {
    warnings.push('Cambagem forte gasta a parte de dentro do pneu bem rápido.');
  }
  if (tireFor(car.rim) === null) {
    warnings.push(`Aro ${car.rim} fora da base de pneus.`);
  }
  return { ok: warnings.length === 0, warnings };
}

export type Clearance = 'passa' | 'raspa' | 'nao_passa';

/**
 * Se um obstáculo raspa NESSE carro.
 * baseRisk: 0 (tranquilo) a 3 (não passa baixo), vindo do banco.
 * votes: o que a galera disse, cada voto com o vão livre de quem votou.
 * Usa primeiro os votos de carros parecidos (até 2 cm de diferença); sem eles, cai no risco base.
 */
export function clearanceFor(
  rideHeightCm: number,
  baseRisk: number,
  votes: { clearance: Clearance; rideHeightCm: number }[] = [],
  suspension: Suspension = 'fixa',
): Clearance {
  const near = votes.filter((v) => Math.abs(v.rideHeightCm - rideHeightCm) <= 2);
  let result: Clearance;
  if (near.length >= 2) {
    const count = { passa: 0, raspa: 0, nao_passa: 0 };
    near.forEach((v) => count[v.clearance]++);
    result = (Object.keys(count) as Clearance[]).reduce((a, b) => (count[b] > count[a] ? b : a), 'passa');
  } else if (baseRisk <= 0) {
    result = 'passa';
  } else if (rideHeightCm >= 13) {
    result = baseRisk >= 3 ? 'raspa' : 'passa';
  } else if (rideHeightCm >= 9) {
    result = baseRisk >= 2 ? 'raspa' : 'passa';
  } else {
    result = baseRisk >= 3 ? 'nao_passa' : 'raspa';
  }
  // com ar dá pra subir o carro: "não passa" vira "raspa" (o app avisa pra subir antes)
  if (suspension === 'ar' && result === 'nao_passa') result = 'raspa';
  return result;
}

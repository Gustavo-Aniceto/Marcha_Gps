// Converte o palpite da IA (POST /carro/analisar) nos campos da garagem.
import { CAR_COLORS, type BodyType } from './carBodies.ts';

export interface CarGuess {
  e_carro: boolean;
  body_type: BodyType;
  cor: string;
  marca: string;
  modelo: string;
  vidro: 'nenhuma' | 'fume' | 'limo';
  aerofolio: boolean;
  rebaixado: boolean;
  confianca: number;
}

export interface GuessedCar {
  body_type: BodyType;
  color: string;
  make: string;
  model: string;
  tint: 'nenhuma' | 'fume' | 'limo';
  spoiler: boolean;
  ride_height_cm?: number; // só quando a IA viu que é rebaixado
}

export function colorHex(name: string): string {
  return CAR_COLORS.find(([, n]) => n.toLowerCase() === name.toLowerCase())?.[0] ?? '#B9C0CB';
}

/** Campos pra preencher na garagem. Marca/modelo vazios não apagam o que a pessoa já digitou. */
export function guessToCar(g: CarGuess, current?: { make: string; model: string }): GuessedCar {
  return {
    body_type: g.body_type,
    color: colorHex(g.cor),
    make: g.marca || current?.make || '',
    model: g.modelo || current?.model || '',
    tint: g.vidro,
    spoiler: g.aerofolio,
    ...(g.rebaixado ? { ride_height_cm: 8 } : {}),
  };
}

/** Frase do resultado pra mostrar à pessoa. */
export function guessSummary(g: CarGuess, bodyLabel: string): string {
  const name = [g.marca, g.modelo].filter(Boolean).join(' ');
  const parts = [name || null, bodyLabel, g.cor, g.vidro !== 'nenhuma' ? (g.vidro === 'fume' ? 'vidro fumê' : 'vidro limo') : null,
    g.aerofolio ? 'com aerofólio' : null, g.rebaixado ? 'rebaixado' : null].filter(Boolean);
  const sure = g.confianca >= 0.8 ? '' : g.confianca >= 0.5 ? ' (confere se acertei)' : ' (não tenho certeza: confere)';
  return `${parts.join(' · ')}${sure}`;
}

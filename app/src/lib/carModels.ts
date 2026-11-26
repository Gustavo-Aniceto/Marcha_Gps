// Modelos de carro conhecidos no Brasil: proporções de cada um pro desenho 3D (comprimento, altura,
// capô, teto, traseira, cantos, faróis). Desenho nosso, feito das medidas; não copia modelo de ninguém.
// Escolhe pela marca/modelo/versão (da garagem ou da tabela FIPE) e pelo ano (gerações diferentes).
import { baseFor, type ModelDef } from './car3dShape.ts';

type Over = Partial<ModelDef>;
interface Entry { id: string; label: string; re: RegExp; body: string; years?: [number, number]; over: Over }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

// a ordem importa: o primeiro que bater ganha (gerações mais específicas antes)
const E: Entry[] = [
  // ---------- Volkswagen ----------
  { id: 'gol_g1', label: 'Gol quadrado', re: /\bGOL\b/, body: 'hatch', years: [1980, 1994],
    over: { L: 3.81, W: 1.6, roofY: 1.15, boxy: 0.95, rF: 0.14, rR: 0.12, roofFX: -0.12, roofRX: -1.22, deckX: -1.74, hoodY: 0.74, noseY: 0.6, lights: 'square' } },
  { id: 'gol_g2', label: 'Gol bolinha', re: /\bGOL\b/, body: 'hatch', years: [1995, 2005],
    over: { L: 3.89, W: 1.64, roofY: 1.17, boxy: 0.2, rF: 0.55, rR: 0.38, lights: 'big' } },
  { id: 'gol_g5', label: 'Gol G5/G6', re: /\bGOL\b/, body: 'hatch', years: [2006, 2016], over: { L: 3.9, W: 1.66, boxy: 0.45 } },
  { id: 'gol_g7', label: 'Gol G7/G8', re: /\bGOL\b/, body: 'hatch', over: { L: 3.92, W: 1.66, boxy: 0.55, lights: 'slim' } },
  { id: 'voyage_g1', label: 'Voyage quadrado', re: /\bVOYAGE\b/, body: 'seda', years: [1981, 1996],
    over: { L: 4.15, W: 1.6, roofY: 1.15, boxy: 0.95, rF: 0.14, rR: 0.12 } },
  { id: 'voyage', label: 'Voyage', re: /\bVOYAGE\b/, body: 'seda', over: { L: 4.22, W: 1.66, boxy: 0.45 } },
  { id: 'parati_g1', label: 'Parati quadrada', re: /\bPARATI\b/, body: 'perua', years: [1982, 1995],
    over: { L: 4.1, W: 1.6, roofY: 1.18, boxy: 0.95, rF: 0.14, rR: 0.1 } },
  { id: 'parati', label: 'Parati', re: /\bPARATI\b/, body: 'perua', over: { L: 4.2, W: 1.65, boxy: 0.3, rF: 0.5 } },
  { id: 'saveiro_g1', label: 'Saveiro quadrada', re: /\bSAVEIRO\b/, body: 'picape', years: [1982, 1996],
    over: { L: 4.2, W: 1.6, roofY: 1.15, boxy: 0.95, rF: 0.14, rR: 0.08 } },
  { id: 'saveiro', label: 'Saveiro', re: /\bSAVEIRO\b/, body: 'picape', over: { L: 4.5, W: 1.72 } },
  { id: 'fusca', label: 'Fusca', re: /\bFUSCA\b|\bBEETLE\b/, body: 'hatch',
    over: { L: 4.08, W: 1.55, wb: 2.4, fo: 0.72, roofY: 1.28, noseY: 0.48, hoodY: 0.72, cowlX: 0.58, roofFX: 0.12, roofRX: -0.52,
            deckX: -1.5, deckY: 0.78, tailY: 0.52, rF: 0.75, rR: 0.75, boxy: 0, tumble: 0.72, lights: 'round', tail: 'round' } },
  { id: 'brasilia', label: 'Brasília', re: /\bBRASILIA\b/, body: 'hatch',
    over: { L: 4.01, W: 1.6, roofY: 1.24, boxy: 0.9, rF: 0.15, rR: 0.12, roofRX: -1.55, deckX: -1.92, deckY: 0.9, lights: 'round' } },
  { id: 'kombi', label: 'Kombi', re: /\bKOMBI\b/, body: 'van',
    over: { L: 4.5, W: 1.72, roofY: 1.76, rF: 0.42, rR: 0.32, boxy: 0.55, cowlX: 2.1, roofFX: 1.86, lights: 'round', tail: 'round' } },
  { id: 'fox', label: 'Fox', re: /\bFOX\b|\bCROSSFOX\b/, body: 'hatch',
    over: { L: 3.83, W: 1.64, roofY: 1.32, boxy: 0.5, roofRX: -1.42, deckX: -1.8, rR: 0.22 } },
  { id: 'spacefox', label: 'SpaceFox', re: /\bSPACEFOX\b|\bSPACECROSS\b/, body: 'perua', over: { L: 4.18, roofY: 1.35, boxy: 0.5 } },
  { id: 'up', label: 'up!', re: /\bUP\b/, body: 'hatch',
    over: { L: 3.6, W: 1.64, wb: 2.42, fo: 0.6, roofY: 1.28, cowlX: 0.62, roofFX: -0.1, roofRX: -1.35, deckX: -1.68, rR: 0.14, boxy: 0.6 } },
  { id: 'polo', label: 'Polo', re: /\bPOLO\b/, body: 'hatch', over: { L: 4.06, W: 1.75, roofY: 1.17, boxy: 0.5, lights: 'slim' } },
  { id: 'golf', label: 'Golf', re: /\bGOLF\b/, body: 'hatch', over: { L: 4.2, W: 1.76, roofY: 1.18, boxy: 0.5, roofRX: -1.45, deckX: -1.88 } },
  { id: 'virtus', label: 'Virtus/Jetta', re: /\bVIRTUS\b|\bJETTA\b|\bBORA\b|\bPASSAT\b|\bSANTANA\b/, body: 'seda',
    over: { L: 4.55, W: 1.76, boxy: 0.5 } },
  { id: 'tcross', label: 'T-Cross/Nivus', re: /\bT ?CROSS\b|\bNIVUS\b|\bTAOS\b|\bTIGUAN\b/, body: 'suv', over: { L: 4.2, roofY: 1.42 } },
  { id: 'amarok', label: 'Amarok', re: /\bAMAROK\b/, body: 'picape_grande', over: { L: 5.25, boxy: 0.75 } },

  // ---------- Chevrolet ----------
  { id: 'chevette', label: 'Chevette', re: /\bCHEVETTE\b|\bMARAJO\b/, body: 'seda',
    over: { L: 4.18, W: 1.57, roofY: 1.15, boxy: 0.85, rF: 0.15, rR: 0.12, cowlX: 0.82, lights: 'square' } },
  { id: 'opala_cp', label: 'Opala coupé', re: /\bOPALA\b.*\bCOUPE\b|\bOPALA\b.*\bSS\b/, body: 'esportivo',
    over: { L: 4.75, W: 1.75, roofY: 1.08, cowlX: 1.05, roofFX: 0.15, roofRX: -0.85, deckX: -1.5, deckY: 0.76, tailY: 0.74, boxy: 0.85, rF: 0.15, rR: 0.12, lights: 'round' } },
  { id: 'opala', label: 'Opala', re: /\bOPALA\b|\bCARAVAN\b/, body: 'seda',
    over: { L: 4.75, W: 1.75, roofY: 1.12, wb: 2.67, cowlX: 1.05, roofFX: 0.15, roofRX: -1.0, deckX: -1.45, boxy: 0.85, rF: 0.15, rR: 0.12, lights: 'square' } },
  { id: 'monza', label: 'Monza', re: /\bMONZA\b/, body: 'seda', over: { L: 4.36, W: 1.67, roofY: 1.18, boxy: 0.8, rF: 0.18, rR: 0.15 } },
  { id: 'kadett', label: 'Kadett', re: /\bKADETT\b/, body: 'hatch', over: { L: 4.06, W: 1.66, roofY: 1.16, boxy: 0.65, roofRX: -1.42 } },
  { id: 'calibra', label: 'Calibra', re: /\bCALIBRA\b/, body: 'esportivo', over: { L: 4.49, W: 1.69 } },
  { id: 'celta', label: 'Celta', re: /\bCELTA\b/, body: 'hatch', over: { L: 3.75, W: 1.63, roofY: 1.2, boxy: 0.3, rF: 0.55, lights: 'big' } },
  { id: 'corsa_g1', label: 'Corsa', re: /\bCORSA\b/, body: 'hatch', years: [1994, 2002],
    over: { L: 3.73, W: 1.61, roofY: 1.2, boxy: 0.25, rF: 0.55, rR: 0.42, lights: 'big' } },
  { id: 'corsa', label: 'Corsa', re: /\bCORSA\b/, body: 'hatch', over: { L: 3.82, W: 1.65, roofY: 1.22, boxy: 0.35 } },
  { id: 'corsa_seda', label: 'Corsa sedã/Classic', re: /\bCORSA\b|\bCLASSIC\b/, body: 'seda', over: { L: 4.15, W: 1.61, boxy: 0.3, rF: 0.55 } },
  { id: 'prisma', label: 'Prisma/Onix Plus', re: /\bPRISMA\b|\bONIX\b/, body: 'seda', over: { L: 4.27, W: 1.71, boxy: 0.45, lights: 'slim' } },
  { id: 'onix', label: 'Onix', re: /\bONIX\b|\bAGILE\b|\bSONIC\b/, body: 'hatch', over: { L: 3.93, W: 1.7, roofY: 1.18, boxy: 0.45, lights: 'slim' } },
  { id: 'astra', label: 'Astra', re: /\bASTRA\b/, body: 'hatch', over: { L: 4.11, W: 1.71, roofY: 1.18, boxy: 0.35, rF: 0.5 } },
  { id: 'vectra', label: 'Vectra/Cruze', re: /\bVECTRA\b|\bCRUZE\b|\bOMEGA\b/, body: 'seda', over: { L: 4.6, W: 1.75, boxy: 0.4 } },
  { id: 'montana', label: 'Montana', re: /\bMONTANA\b/, body: 'picape', over: { L: 4.5, W: 1.7 } },
  { id: 's10', label: 'S10', re: /\bS ?10\b|\bD ?20\b|\bC ?20\b|\bSILVERADO\b/, body: 'picape_grande', over: {} },
  { id: 'tracker', label: 'Tracker', re: /\bTRACKER\b|\bEQUINOX\b|\bTRAILBLAZER\b|\bBLAZER\b/, body: 'suv', over: { L: 4.27 } },
  { id: 'camaro', label: 'Camaro', re: /\bCAMARO\b/, body: 'esportivo', over: { L: 4.78, W: 1.9, roofY: 1.0, cowlX: 1.05 } },

  // ---------- Fiat ----------
  { id: 'f147', label: 'Fiat 147', re: /\b147\b|\bSPAZIO\b/, body: 'hatch',
    over: { L: 3.63, W: 1.55, roofY: 1.2, boxy: 0.92, rF: 0.12, rR: 0.1, roofRX: -1.25, deckX: -1.72 } },
  { id: 'uno_old', label: 'Uno Mille', re: /\bUNO\b|\bMILLE\b/, body: 'hatch', years: [1984, 2009],
    over: { L: 3.69, W: 1.55, wb: 2.36, fo: 0.62, roofY: 1.27, boxy: 0.92, rF: 0.18, rR: 0.08, roofRX: -1.4, deckX: -1.76, deckY: 0.92, lights: 'square' } },
  { id: 'uno', label: 'Uno', re: /\bUNO\b/, body: 'hatch',
    over: { L: 3.77, W: 1.64, roofY: 1.27, boxy: 0.75, rF: 0.3, rR: 0.12, roofRX: -1.42, deckX: -1.78 } },
  { id: 'palio_wk', label: 'Palio Weekend', re: /\bWEEKEND\b/, body: 'perua', over: { L: 4.22, W: 1.62, boxy: 0.35 } },
  { id: 'palio', label: 'Palio', re: /\bPALIO\b/, body: 'hatch', over: { L: 3.83, W: 1.62, roofY: 1.22, boxy: 0.3, rF: 0.5 } },
  { id: 'siena', label: 'Siena/Grand Siena', re: /\bSIENA\b|\bCRONOS\b|\bTEMPRA\b|\bTIPO\b/, body: 'seda', over: { L: 4.3, W: 1.65 } },
  { id: 'strada', label: 'Strada', re: /\bSTRADA\b|\bFIORINO\b/, body: 'picape', over: { L: 4.47, W: 1.66 } },
  { id: 'toro', label: 'Toro', re: /\bTORO\b/, body: 'picape_grande', over: { L: 4.92, W: 1.84, roofY: 1.48, noseY: 0.9, lights: 'slim' } },
  { id: 'mobi', label: 'Mobi', re: /\bMOBI\b/, body: 'hatch',
    over: { L: 3.57, W: 1.63, wb: 2.3, fo: 0.62, roofY: 1.26, boxy: 0.6, roofRX: -1.32, deckX: -1.66, rR: 0.14 } },
  { id: 'argo', label: 'Argo', re: /\bARGO\b|\bPUNTO\b|\bBRAVO\b|\bSTILO\b/, body: 'hatch', over: { L: 4.0, W: 1.72, boxy: 0.45, lights: 'slim' } },
  { id: 'pulse', label: 'Pulse/Fastback', re: /\bPULSE\b|\bFASTBACK\b/, body: 'suv', over: { L: 4.1, roofY: 1.38 } },

  // ---------- Ford ----------
  { id: 'ka_old', label: 'Ka bolinha', re: /\bKA\b/, body: 'hatch', years: [1997, 2007],
    over: { L: 3.62, W: 1.63, wb: 2.45, fo: 0.58, roofY: 1.2, boxy: 0.05, rF: 0.62, rR: 0.55, tumble: 0.74, lights: 'big', tail: 'round' } },
  { id: 'ka_seda', label: 'Ka sedã', re: /\bKA\b/, body: 'seda', over: { L: 4.25, W: 1.7 } },
  { id: 'ka', label: 'Ka', re: /\bKA\b/, body: 'hatch', over: { L: 3.93, W: 1.7, boxy: 0.45 } },
  { id: 'fiesta', label: 'Fiesta', re: /\bFIESTA\b/, body: 'hatch', over: { L: 3.95, W: 1.72, boxy: 0.4 } },
  { id: 'escort', label: 'Escort', re: /\bESCORT\b/, body: 'hatch', over: { L: 4.05, W: 1.69, boxy: 0.55 } },
  { id: 'maverick_old', label: 'Maverick', re: /\bMAVERICK\b/, body: 'esportivo', years: [1973, 1979],
    over: { L: 4.6, W: 1.79, roofY: 1.08, cowlX: 1.1, boxy: 0.8, rF: 0.15, lights: 'round' } },
  { id: 'ecosport', label: 'EcoSport', re: /\bECOSPORT\b|\bTERRITORY\b/, body: 'suv', over: { L: 4.25, W: 1.76 } },
  { id: 'ranger', label: 'Ranger', re: /\bRANGER\b|\bF ?1000\b|\bF ?250\b|\bMAVERICK\b/, body: 'picape_grande', over: {} },
  { id: 'focus', label: 'Focus', re: /\bFOCUS\b/, body: 'hatch', over: { L: 4.36, W: 1.76 } },

  // ---------- outros ----------
  { id: 'hb20s', label: 'HB20S', re: /\bHB20 ?S\b/, body: 'seda', over: { L: 4.25, W: 1.72, lights: 'slim' } },
  { id: 'hb20', label: 'HB20', re: /\bHB20\b|\bI30\b|\bI20\b/, body: 'hatch', over: { L: 3.94, W: 1.72, boxy: 0.4 } },
  { id: 'creta', label: 'Creta/Tucson', re: /\bCRETA\b|\bTUCSON\b|\bIX35\b/, body: 'suv', over: { L: 4.3 } },
  { id: 'civic', label: 'Civic', re: /\bCIVIC\b/, body: 'seda', over: { L: 4.6, W: 1.8, roofY: 1.14, boxy: 0.3, lights: 'slim' } },
  { id: 'corolla', label: 'Corolla', re: /\bCOROLLA\b|\bCAMRY\b/, body: 'seda', over: { L: 4.63, W: 1.78, roofY: 1.17, boxy: 0.35 } },
  { id: 'fit', label: 'Fit', re: /\bFIT\b|\bWR ?V\b/, body: 'hatch',
    over: { L: 4.0, W: 1.69, roofY: 1.33, cowlX: 1.0, roofFX: 0.32, roofRX: -1.55, deckX: -1.88, rR: 0.16, boxy: 0.5 } },
  { id: 'city', label: 'City', re: /\bCITY\b/, body: 'seda', over: { L: 4.45, W: 1.7 } },
  { id: 'hrv', label: 'HR-V', re: /\bHR ?V\b|\bCR ?V\b/, body: 'suv', over: { L: 4.3 } },
  { id: 'yaris', label: 'Yaris/Etios', re: /\bYARIS\b|\bETIOS\b/, body: 'hatch', over: { L: 3.94, W: 1.7 } },
  { id: 'hilux', label: 'Hilux', re: /\bHILUX\b|\bL200\b|\bTRITON\b|\bFRONTIER\b/, body: 'picape_grande', over: {} },
  { id: 'kicks', label: 'Kicks', re: /\bKICKS\b/, body: 'suv', over: { L: 4.3, roofY: 1.42 } },
  { id: 'march', label: 'March', re: /\bMARCH\b/, body: 'hatch', over: { L: 3.82, W: 1.66, roofY: 1.28, boxy: 0.2, rF: 0.55, lights: 'big' } },
  { id: 'sandero', label: 'Sandero', re: /\bSANDERO\b|\bSTEPWAY\b|\bCLIO\b/, body: 'hatch', over: { L: 4.06, W: 1.73, roofY: 1.25 } },
  { id: 'logan', label: 'Logan', re: /\bLOGAN\b|\bSYMBOL\b/, body: 'seda', over: { L: 4.35, W: 1.73, roofY: 1.25 } },
  { id: 'kwid', label: 'Kwid', re: /\bKWID\b/, body: 'hatch',
    over: { L: 3.68, W: 1.58, roofY: 1.26, wb: 2.42, fo: 0.6, boxy: 0.7, roofRX: -1.35, deckX: -1.7, rR: 0.14 } },
  { id: 'duster', label: 'Duster', re: /\bDUSTER\b|\bCAPTUR\b|\bOROCH\b/, body: 'suv', over: { L: 4.34, boxy: 0.75 } },
  { id: 'renegade', label: 'Renegade', re: /\bRENEGADE\b/, body: 'suv',
    over: { L: 4.25, W: 1.8, roofY: 1.5, boxy: 0.9, rF: 0.2, rR: 0.14, lights: 'round' } },
  { id: 'compass', label: 'Compass', re: /\bCOMPASS\b|\bCOMMANDER\b/, body: 'suv', over: { L: 4.4, W: 1.82 } },
  { id: 'lancer', label: 'Lancer', re: /\bLANCER\b/, body: 'seda', over: { L: 4.57, W: 1.76, boxy: 0.5 } },
  { id: 'eclipse', label: 'Eclipse', re: /\bECLIPSE\b/, body: 'esportivo', over: { L: 4.4, W: 1.75 } },
  { id: 'bmw3', label: 'BMW Série 3', re: /\b3[0-9]{2}I\b|\bSERIE 3\b|\bM3\b/, body: 'seda', over: { L: 4.7, W: 1.83, roofY: 1.15, cowlX: 1.15 } },
  { id: 'mustang', label: 'Mustang', re: /\bMUSTANG\b/, body: 'esportivo', over: { L: 4.79, W: 1.92, cowlX: 1.15 } },
  { id: 'gti', label: 'esportivo', re: /\bGTI\b|\bGSI\b|\bTURBO\b/, body: 'esportivo', over: {} },
];

const X_KEYS = ['wb', 'fo', 'cowlX', 'roofFX', 'roofRX', 'deckX', 'sideRear', 'bedX'] as const;

/** Base do tipo + ajustes do modelo. Comprimento diferente: as posições (para-brisa, teto, eixos) acompanham. */
export function compose(body: string, over: Over): ModelDef {
  const base = baseFor(body);
  const k = over.L ? over.L / base.L : 1;
  const scaled: Partial<ModelDef> = {};
  for (const key of X_KEYS) {
    const v = base[key];
    if (typeof v === 'number') (scaled as Record<string, number>)[key] = v * k;
  }
  return { ...base, ...scaled, ...over, body };
}

export interface ResolvedModel { id: string; label: string | null; def: ModelDef }

/** Escolhe as proporções do carro. Sem modelo conhecido (ou tipo diferente do escolhido), usa o tipo da garagem. */
export function resolveModel(car: { body?: string | null; make?: string | null; model?: string | null;
  version?: string | null; year?: number | null }): ResolvedModel {
  const body = car.body ?? 'hatch';
  const name = norm(`${car.make ?? ''} ${car.model ?? ''} ${car.version ?? ''}`);
  if (name) {
    for (const e of E) {
      if (e.body !== body) continue;
      if (!e.re.test(name)) continue;
      // geração por ano: sem ano, fica com o modelo genérico (o último da lista pra aquele nome)
      if (e.years && (!car.year || car.year < e.years[0] || car.year > e.years[1])) continue;
      return { id: e.id, label: e.label, def: compose(body, e.over) };
    }
  }
  return { id: body, label: null, def: baseFor(body) };
}

export const MODEL_IDS = E.map((e) => e.id);
export const MODEL_ENTRIES = E.map((e) => ({ id: e.id, body: e.body, def: compose(e.body, e.over) }));

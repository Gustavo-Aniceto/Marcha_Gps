// "Montar pelo foto": a IA com visão (Workers AI) olha as fotos do carro e diz tipo, cor, marca e modelo.
// O app usa a resposta pra montar o carrinho do mapa (a pessoa confere e salva na garagem).
// As listas aqui precisam bater com app/src/lib/carBodies.ts (tem teste que confere).

export const VISION_MODEL = '@cf/google/gemma-4-26b-a4b-it';

export const BODY_IDS = ['hatch', 'seda', 'perua', 'picape', 'picape_grande', 'suv', 'esportivo', 'van'] as const;
export const COLOR_NAMES = [
  'Prata', 'Preto', 'Branco', 'Grafite', 'Vermelho', 'Vinho', 'Laranja', 'Amarelo', 'Verde-limão', 'Verde',
  'Turquesa', 'Azul-bebê', 'Azul', 'Roxo', 'Rosa', 'Bege', 'Marrom',
] as const;
export const TINTS = ['nenhuma', 'fume', 'limo'] as const;

export type BodyId = (typeof BODY_IDS)[number];
export type ColorName = (typeof COLOR_NAMES)[number];

export interface CarGuess {
  e_carro: boolean;
  body_type: BodyId;
  cor: ColorName;
  marca: string;
  modelo: string;
  vidro: (typeof TINTS)[number];
  aerofolio: boolean;
  rebaixado: boolean;
  confianca: number; // 0 a 1
}

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_CHARS = 1_400_000; // ~1 MB de JPEG em base64

const SYSTEM = `Você reconhece carros brasileiros em fotos para montar um desenho do carro visto de cima.
Responda só o JSON pedido. Regras:
- body_type: hatch (Gol, Celta, Palio, Onix hatch, Fox), seda (Voyage, Prisma, Civic, Corolla, Siena),
  perua (Parati, Quantum, Fielder, Palio Weekend, SpaceFox), picape (Saveiro, Strada, Montana, Courier),
  picape_grande (Hilux, S10, Ranger, Amarok, F-1000, D20), suv (EcoSport, Duster, Tracker, Compass, HR-V),
  esportivo (coupês e esportivos: Golf GTI, Calibra, Opala coupê, Camaro, Mustang, Kadett GSI), van (Kombi, Sprinter, Doblò, Ducato).
- cor: a cor da pintura, escolhendo a mais parecida da lista.
- vidro: "fume" se o vidro é escuro, "limo" se é bem preto (quase não dá pra ver dentro), senão "nenhuma".
- aerofolio: true só se tiver aerofólio/spoiler traseiro visível.
- rebaixado: true se o carro está visivelmente mais baixo que o original.
- marca e modelo: em português, como o brasileiro fala (ex.: "Volkswagen", "Gol G5"). Se não souber, "".
- e_carro: false se a foto não mostra um carro.
- confianca: de 0 a 1, o quanto você tem certeza do tipo e da cor.`;

export const GUESS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['e_carro', 'body_type', 'cor', 'marca', 'modelo', 'vidro', 'aerofolio', 'rebaixado', 'confianca'],
  properties: {
    e_carro: { type: 'boolean' },
    body_type: { type: 'string', enum: [...BODY_IDS] },
    cor: { type: 'string', enum: [...COLOR_NAMES] },
    marca: { type: 'string' },
    modelo: { type: 'string' },
    vidro: { type: 'string', enum: [...TINTS] },
    aerofolio: { type: 'boolean' },
    rebaixado: { type: 'boolean' },
    confianca: { type: 'number' },
  },
} as const;

/** Confere as fotos que vieram do app: 1 a 3 imagens JPEG/PNG/WEBP em data URI. */
export function validPhotos(input: unknown): string[] | null {
  const list = (input as { fotos?: unknown })?.fotos;
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_PHOTOS) return null;
  for (const f of list) {
    if (typeof f !== 'string' || f.length > MAX_PHOTO_CHARS) return null;
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f)) return null;
  }
  return list as string[];
}

/** Pedido pro modelo de visão. */
export function visionRequest(photos: string[]) {
  return {
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: `São ${photos.length} foto(s) do mesmo carro. Monte o JSON.` },
          ...photos.map((url) => ({ type: 'image_url', image_url: { url, detail: 'low' } })),
        ],
      },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'carro', schema: GUESS_SCHEMA, strict: true } },
    // sem "pensar em voz alta": responde direto o JSON (mais rápido e gasta menos da cota)
    chat_template_kwargs: { enable_thinking: false },
    max_tokens: 400,
    temperature: 0.1,
  };
}

const clean = (s: unknown, max = 40) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '');
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  (typeof v === 'string' && (list as readonly string[]).includes(v) ? v : fallback) as T;

/** Lê a resposta do modelo (texto JSON, objeto ou { response }) e devolve um palpite seguro. */
export function parseGuess(raw: unknown): CarGuess | null {
  let obj: unknown = raw;
  if (obj && typeof obj === 'object' && 'response' in obj) obj = (obj as { response: unknown }).response;
  if (obj && typeof obj === 'object' && 'choices' in obj) {
    obj = (obj as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
  }
  if (typeof obj === 'string') {
    const m = obj.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { obj = JSON.parse(m[0]); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const conf = typeof o.confianca === 'number' && Number.isFinite(o.confianca) ? Math.min(1, Math.max(0, o.confianca)) : 0.5;
  return {
    e_carro: o.e_carro !== false,
    body_type: oneOf(o.body_type, BODY_IDS, 'hatch'),
    cor: oneOf(o.cor, COLOR_NAMES, 'Prata'),
    marca: clean(o.marca),
    modelo: clean(o.modelo),
    vidro: oneOf(o.vidro, TINTS, 'nenhuma'),
    aerofolio: o.aerofolio === true,
    rebaixado: o.rebaixado === true,
    confianca: Math.round(conf * 100) / 100,
  };
}

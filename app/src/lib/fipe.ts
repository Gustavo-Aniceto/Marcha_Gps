// Ficha do carro pela tabela FIPE: lógica pura (achar a marca e o modelo que a IA reconheceu,
// juntar as versões por modelo, ler ano/combustível). As chamadas ficam em routing.ts (fipeMarcas etc.).

export interface FipeItem { codigo: string; nome: string }
export interface FipeValor {
  valor: string; marca: string; modelo: string; ano: number; combustivel: string; codigo_fipe: string; referencia: string;
}
export interface Family { name: string; key: string; versions: FipeItem[] }

/** Sem acento, maiúsculo, só letras e números. */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

// apelidos que a galera (e a IA) usa pra marca
const BRAND_ALIASES: Record<string, string[]> = {
  'GM CHEVROLET': ['GM', 'CHEVROLET', 'CHEVY', 'CHEVROLE'],
  'VW VOLKSWAGEN': ['VW', 'VOLKSWAGEN', 'VOLKS', 'WOLKSWAGEN'],
  'MERCEDES BENZ': ['MERCEDES', 'MERCEDES BENZ', 'BENZ'],
  'CITROEN': ['CITROEN'],
  'LAND ROVER': ['LAND ROVER', 'LANDROVER', 'RANGE ROVER'],
};

/** Marca da FIPE que bate com o nome que a IA ou a pessoa deu (ou null). */
export function matchBrand(name: string, brands: FipeItem[]): FipeItem | null {
  const n = norm(name);
  if (!n) return null;
  for (const b of brands) {
    const bn = norm(b.nome);
    if (bn === n) return b;
    if ((BRAND_ALIASES[bn] ?? []).includes(n)) return b;
  }
  // "GM - Chevrolet" contém "CHEVROLET"; "Fiat" = "FIAT"
  return brands.find((b) => norm(b.nome).split(' ').includes(n)) ?? null;
}

/** Nome do modelo sem a versão: "Astra GLS 2.0 MPFI" -> "Astra"; "Gol (novo) 1.0" -> "Gol"; "Palio Weekend ..." -> "Palio". */
export function familyName(model: string): string {
  const first = model.trim().split(/[\s/(]+/)[0] ?? model;
  return first.replace(/[-.,]+$/, '') || model.trim();
}

/** Junta as versões da FIPE por modelo (Astra, Gol, Corsa...), em ordem alfabética. */
export function groupFamilies(models: FipeItem[]): Family[] {
  const map = new Map<string, Family>();
  for (const m of models) {
    const name = familyName(m.nome);
    const key = norm(name);
    const f = map.get(key) ?? { name: name.toUpperCase(), key, versions: [] };
    f.versions.push(m);
    map.set(key, f);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Modelo que bate com o que a IA reconheceu ("Astra hatch", "Gol G2"...). */
export function matchFamily(model: string, families: Family[]): Family | null {
  const words = norm(model).split(' ').filter(Boolean);
  if (!words.length) return null;
  return families.find((f) => f.key === words.join(' ')) ?? families.find((f) => words.includes(f.key)) ?? null;
}

/** Versão sem o nome do modelo na frente: ("Astra GLS 2.0 MPFI", "ASTRA") -> "GLS 2.0 MPFI". */
export function versionLabel(model: string, family: string): string {
  const rest = model.trim().slice(familyName(model).length).trim();
  return rest || model.trim() || family;
}

/** "1995 Gasolina" / "32000 Diesel" (zero km) -> ano e combustível. */
export function parseYearName(name: string): { year: number | null; fuel: string } {
  const m = /^(\d{4,5})\s*(.*)$/.exec(name.trim());
  if (!m) return { year: null, fuel: name.trim() };
  const y = Number(m[1]);
  return { year: y >= 1900 && y <= 2100 ? y : null, fuel: m[2].trim() };
}

/** Rótulo do ano pra lista: zero km da FIPE vem como 32000. */
export function yearLabel(name: string): string {
  const { year, fuel } = parseYearName(name);
  return `${year ?? 'Zero km'}${fuel ? ` · ${fuel}` : ''}`;
}

/** Ano mais perto do que a pessoa disse (ou o mais novo). */
export function closestYear(years: FipeItem[], wanted: number | null | undefined): FipeItem | null {
  if (!years.length) return null;
  if (!wanted) return years[0];
  let best = years[0], diff = Infinity;
  for (const y of years) {
    const v = parseYearName(y.nome).year;
    if (v != null && Math.abs(v - wanted) < diff) { best = y; diff = Math.abs(v - wanted); }
  }
  return best;
}

/** Marca como aparece pra gente: "GM - Chevrolet" -> "Chevrolet", "VW - VolksWagen" -> "Volkswagen". */
export function brandLabel(fipeBrand: string): string {
  const name = fipeBrand.includes(' - ') ? fipeBrand.split(' - ').pop()! : fipeBrand;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** Campos do carro a partir do resultado da FIPE. */
export function fipeToCar(v: FipeValor, family: string) {
  return {
    make: brandLabel(v.marca),
    model: family.charAt(0) + family.slice(1).toLowerCase(),
    year: v.ano >= 1950 && v.ano <= 2100 ? v.ano : null,
    fipe_code: v.codigo_fipe, fipe_brand: v.marca, fipe_model: v.modelo, fipe_version: versionLabel(v.modelo, family),
    fipe_year: v.ano >= 1950 && v.ano <= 2100 ? v.ano : null, fipe_fuel: v.combustivel, fipe_price: v.valor, fipe_ref: v.referencia,
  };
}

// ---- plano B: falar direto com a API pública pelo aparelho da pessoa ----
// O serviço (workers/api) guarda em cache, mas a API pública às vezes barra os servidores da Cloudflare
// (todo mundo sai pelos mesmos IPs). Aí o app pede direto: cada aparelho tem a sua cota (~500/dia).
export const FIPE_PUBLIC = 'https://parallelum.com.br/fipe/api/v1/carros';
export type FipeKind = 'marcas' | 'modelos' | 'anos' | 'valor';

/** URL direta da API pública (mesmas regras de validação do serviço). */
export function fipeDirectUrl(kind: FipeKind, marca = '', modelo = '', ano = ''): string | null {
  const num = /^[0-9]{1,6}$/, yr = /^[0-9]{4}-[0-9]$/;
  if (kind === 'marcas') return `${FIPE_PUBLIC}/marcas`;
  if (!num.test(marca)) return null;
  if (kind === 'modelos') return `${FIPE_PUBLIC}/marcas/${marca}/modelos`;
  if (!num.test(modelo)) return null;
  if (kind === 'anos') return `${FIPE_PUBLIC}/marcas/${marca}/modelos/${modelo}/anos`;
  return yr.test(ano) ? `${FIPE_PUBLIC}/marcas/${marca}/modelos/${modelo}/anos/${ano}` : null;
}

function fipeItems(v: unknown): FipeItem[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    const o = x as { codigo?: unknown; nome?: unknown } | null;
    return o && (typeof o.codigo === 'string' || typeof o.codigo === 'number') && typeof o.nome === 'string'
      ? [{ codigo: String(o.codigo), nome: o.nome.trim() }] : [];
  });
}

/** Resposta crua da API pública -> mesmo formato que o serviço devolve. */
export function parseFipeRaw(kind: FipeKind, body: unknown): FipeItem[] | FipeValor | null {
  if (kind === 'modelos') return fipeItems((body as { modelos?: unknown } | null)?.modelos);
  if (kind === 'marcas' || kind === 'anos') return fipeItems(body);
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b.Valor !== 'string' || typeof b.CodigoFipe !== 'string') return null;
  return {
    valor: b.Valor, marca: String(b.Marca ?? ''), modelo: String(b.Modelo ?? ''), ano: Number(b.AnoModelo) || 0,
    combustivel: String(b.Combustivel ?? ''), codigo_fipe: b.CodigoFipe, referencia: String(b.MesReferencia ?? '').trim(),
  };
}

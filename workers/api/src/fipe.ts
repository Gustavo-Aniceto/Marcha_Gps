// Tabela FIPE (marca, modelo, ano, preço) pela API pública do Parallelum.
// Sem chave ela aceita ~500 pedidos por dia, então tudo passa por cache: listas guardadas por 7 dias,
// preço por 1 dia. Lógica pura aqui; a rota fica em index.ts.

export const FIPE_BASE = 'https://parallelum.com.br/fipe/api/v1/carros';

export interface FipeItem { codigo: string; nome: string }
export interface FipeValor {
  valor: string; marca: string; modelo: string; ano: number; combustivel: string; codigo_fipe: string; referencia: string;
}

const NUM = /^[0-9]{1,6}$/;
const ANO = /^[0-9]{4}-[0-9]$/;

/** Monta a URL do Parallelum a partir do que o app pediu, ou null se o pedido for inválido. */
export function fipeTarget(path: string, q: URLSearchParams): { url: string; ttl: number } | null {
  const marca = q.get('marca') ?? '', modelo = q.get('modelo') ?? '', ano = q.get('ano') ?? '';
  const week = 7 * 24 * 3600;
  switch (path) {
    case '/fipe/marcas': return { url: `${FIPE_BASE}/marcas`, ttl: week };
    case '/fipe/modelos':
      return NUM.test(marca) ? { url: `${FIPE_BASE}/marcas/${marca}/modelos`, ttl: week } : null;
    case '/fipe/anos':
      return NUM.test(marca) && NUM.test(modelo) ? { url: `${FIPE_BASE}/marcas/${marca}/modelos/${modelo}/anos`, ttl: week } : null;
    case '/fipe/valor':
      return NUM.test(marca) && NUM.test(modelo) && ANO.test(ano)
        ? { url: `${FIPE_BASE}/marcas/${marca}/modelos/${modelo}/anos/${ano}`, ttl: 24 * 3600 } : null;
    default: return null;
  }
}

function items(v: unknown): FipeItem[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    const o = x as { codigo?: unknown; nome?: unknown };
    return o && (typeof o.codigo === 'string' || typeof o.codigo === 'number') && typeof o.nome === 'string'
      ? [{ codigo: String(o.codigo), nome: o.nome.trim() }] : [];
  });
}

/** Deixa a resposta do Parallelum num formato só (listas viram FipeItem[], valor vira FipeValor). */
export function parseFipe(path: string, body: unknown): FipeItem[] | FipeValor | null {
  if (path === '/fipe/modelos') return items((body as { modelos?: unknown })?.modelos);
  if (path === '/fipe/marcas' || path === '/fipe/anos') return items(body);
  if (path === '/fipe/valor') {
    const b = body as Record<string, unknown>;
    if (!b || typeof b.Valor !== 'string' || typeof b.CodigoFipe !== 'string') return null;
    return {
      valor: b.Valor, marca: String(b.Marca ?? ''), modelo: String(b.Modelo ?? ''), ano: Number(b.AnoModelo) || 0,
      combustivel: String(b.Combustivel ?? ''), codigo_fipe: b.CodigoFipe, referencia: String(b.MesReferencia ?? '').trim(),
    };
  }
  return null;
}

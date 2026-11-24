// O app no navegador (PWA) fala com o serviço de outro domínio: precisa de CORS.
// Liberar qualquer origem é seguro aqui: o envio exige o token do Clerk no cabeçalho
// (não usa cookie), e as imagens já são públicas pela chave impossível de adivinhar.
export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '86400',
};

export function withCors(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS_HEADERS)) out.headers.set(k, v);
  return out;
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

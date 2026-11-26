// Radares oficiais (dados abertos), baixados uma vez por semana pelo agendamento:
//   cet  = CET-SP, cidade de São Paulo (CC-BY 4.0)
//   der  = DER-SP, rodovias estaduais (radares.xml da página "Pesquisa de Radares")
//   antt = ANTT, rodovias federais concedidas (Dutra, Fernão Dias); o arquivo muda de nome todo mês
// O texto vai cru pro banco (import_official_radars), que lê, filtra as 3 cidades e grava:
// assim o Worker quase não gasta processamento.

export type OfficialSource = 'cet' | 'der' | 'antt';
export const OFFICIAL_SOURCES: OfficialSource[] = ['cet', 'der', 'antt'];

export const OFFICIAL_URLS: Record<OfficialSource, string> = {
  cet: 'https://cetsp-dados.github.io/dados-fiscalizacao-eletronica/Base_Locais_Fiscalizados.csv',
  der: 'https://dersp.der.sp.gov.br/Upload/XML/radares.xml',
  antt: 'https://dados.antt.gov.br/api/3/action/package_show?id=radar',
};

/** Da ficha do dataset da ANTT, o CSV mais novo (ou null). */
export function anttLatestCsv(pkg: unknown): string | null {
  const res = (pkg as { result?: { resources?: unknown[] } } | null)?.result?.resources;
  if (!Array.isArray(res)) return null;
  const csvs = res
    .map((r) => r as { format?: unknown; url?: unknown; last_modified?: unknown; created?: unknown })
    .filter((r) => String(r.format ?? '').toUpperCase() === 'CSV' && typeof r.url === 'string'
      && /^https:\/\/dados\.antt\.gov\.br\//.test(r.url as string))
    .sort((a, b) => String(a.last_modified ?? a.created ?? '').localeCompare(String(b.last_modified ?? b.created ?? '')));
  return csvs.length ? (csvs[csvs.length - 1].url as string) : null;
}

/** Texto do arquivo. A ANTT às vezes manda em Latin-1; a CET manda UTF-8 com BOM. */
export function decodeText(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}

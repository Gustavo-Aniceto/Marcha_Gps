// Página do link de convite (https://marcha-gps.vercel.app/c/XXXX-XXXX, a Vercel repassa pra cá).
// Tem a prévia (Open Graph) que o WhatsApp/Instagram mostram e já leva pro app com o código preenchido.

export interface InvitePreview {
  status: 'ok' | 'usado' | 'vencido' | 'nao_existe';
  kind: 'fundador' | 'app' | null;
  inviter: string | null;
  inviter_name: string | null;
  crew_name: string | null;
}

export const APP_URL = 'https://marcha-gps.vercel.app';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function normalizeCode(raw: string): string | null {
  const c = decodeURIComponent(raw || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : null;
}

export function inviteTexts(p: InvitePreview | null): { title: string; description: string; headline: string } {
  if (!p || p.status !== 'ok') {
    const why = p?.status === 'usado' ? 'Esse convite já foi usado.' : p?.status === 'vencido' ? 'Esse convite venceu.' : 'Convite não encontrado.';
    return { title: 'Marcha GPS · convite', description: 'Peça um novo convite pra quem te chamou.', headline: why };
  }
  if (p.kind === 'fundador') {
    return {
      title: 'Marcha GPS · código de fundador',
      description: 'Você recebeu um código de fundador: registre sua equipe no Marcha GPS. Carros modificados e originais.',
      headline: 'Código de fundador pra registrar sua equipe',
    };
  }
  const who = p.inviter_name ? `${p.inviter_name} (@${p.inviter})` : p.inviter ? `@${p.inviter}` : 'Alguém da cena';
  const crew = p.crew_name ? ` da ${p.crew_name}` : '';
  return {
    title: `${who}${crew} te convidou pro Marcha GPS`,
    description: 'Carros modificados e originais: rota que desvia de lombada, avisos da galera, equipes e eventos. Entra com o código.',
    headline: `${who}${crew} te convidou`,
  };
}

export function invitePage(code: string | null, p: InvitePreview | null): string {
  const t = inviteTexts(p);
  const ok = !!code && p?.status === 'ok';
  const target = ok ? `${APP_URL}/inicio?codigo=${encodeURIComponent(code!)}` : `${APP_URL}/inicio`;
  const url = code ? `${APP_URL}/c/${code}` : APP_URL;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Marcha GPS">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${APP_URL}/og-convite.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0A0B0D">
<meta name="robots" content="noindex">
${ok ? `<meta http-equiv="refresh" content="1;url=${esc(target)}">` : ''}
<style>
body{margin:0;background:#0A0B0D;color:#EDEFF2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{max-width:420px;padding:32px 24px;text-align:center}
.b{font-weight:900;font-size:40px;letter-spacing:1px;color:#C9EE62}.b span{color:#EDEFF2}
h1{font-size:22px;margin:18px 0 8px}p{color:#8E949E;line-height:1.5}
.c{font-size:30px;font-weight:800;letter-spacing:4px;margin:18px 0;padding:14px;border:1px solid #363A42;border-radius:20px;background:#15171B}
a.btn{display:block;margin-top:12px;padding:16px;border-radius:14px;background:#C9EE62;color:#0A0B0D;font-weight:800;text-decoration:none}
</style></head>
<body><main>
<div class="b">MARCHA <span>GPS</span></div>
<h1>${esc(t.headline)}</h1>
${ok ? `<div class="c">${esc(code!)}</div>` : ''}
<p>${esc(t.description)}</p>
<a class="btn" href="${esc(target)}">${ok ? 'Entrar com esse convite' : 'Abrir o Marcha GPS'}</a>
</main>${ok ? `<script>setTimeout(function(){location.replace(${JSON.stringify(target)})},600)</script>` : ''}</body></html>`;
}

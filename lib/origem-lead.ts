// De onde veio a pessoa (para o CRM e o painel de Resultados). Serve no navegador e
// no servidor. A origem bruta é gravada pelo Rastreador no cookie "mn_origem" na
// chegada ao site (etiquetas de campanha do link e o site de onde veio) e copiada
// para o pedido quando a pessoa entra em contato.
export type OrigemBruta = { s?: string; m?: string; c?: string; t?: string; ref?: string; clid?: 'fb' | 'gg' | 'tt'; em?: number };
export type Canal = { canal: string; pago: boolean; campanha: string | null };

const PAGO = /^(cpc|ppc|paid|paid[_-]?social|ads?|anuncio|patrocinado|display|cpm)$/i;

function redeDoHost(h: string): string | null {
  if (/(^|\.)instagram\.com$/.test(h)) return 'Instagram';
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(h)) return 'Facebook';
  if (/(^|\.)tiktok\.com$/.test(h)) return 'TikTok';
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) return 'YouTube';
  if (/(^|\.)(gemini\.google\.com|chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|copilot\.microsoft\.com)$/.test(h)) return 'IA (ChatGPT, Gemini e outras)';
  if (/(^|\.)google\.[a-z.]+$/.test(h)) return 'Google';
  if (/(^|\.)(wa\.me|whatsapp\.com)$/.test(h)) return 'WhatsApp';
  if (/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org)$/.test(h)) return 'Outras buscas';
  if (/(^|\.)linkedin\.com$|^lnkd\.in$/.test(h)) return 'LinkedIn';
  return null;
}
function redeDaFonte(s: string): string | null {
  const x = s.toLowerCase();
  if (/^crm$/.test(x)) return 'Link enviado pelo corretor';
  if (/^(ig|instagram)/.test(x)) return 'Instagram';
  if (/^(fb|facebook|meta)/.test(x)) return 'Facebook';
  if (/^(tt|tiktok)/.test(x)) return 'TikTok';
  if (/^(google|gads|adwords)/.test(x)) return 'Google';
  if (/^(yt|youtube)/.test(x)) return 'YouTube';
  if (/^(wa|whatsapp|zap)/.test(x)) return 'WhatsApp';
  if (/^(chatgpt|openai|gemini|perplexity|claude)/.test(x)) return 'IA (ChatGPT, Gemini e outras)';
  return null;
}

export function classificarOrigem(o: OrigemBruta | null | undefined): Canal {
  if (!o) return { canal: 'Direto', pago: false, campanha: null };
  const host = (o.ref ?? '').toLowerCase();
  let canal = (o.s && redeDaFonte(o.s)) || (host && redeDoHost(host)) || null;
  if (!canal && o.clid === 'fb') canal = 'Facebook';
  if (!canal && o.clid === 'tt') canal = 'TikTok';
  if (!canal && o.clid === 'gg') canal = 'Google';
  if (!canal && o.s) canal = o.s.slice(0, 40);
  if (!canal && host) canal = `Outros sites (${host.replace(/^www\./, '').slice(0, 40)})`;
  // anúncio: meio pago nas etiquetas, ou clique de anúncio do Google / TikTok
  const pago = (!!o.m && PAGO.test(o.m)) || o.clid === 'gg' || o.clid === 'tt';
  return { canal: canal ?? 'Direto', pago, campanha: o.c ? o.c.slice(0, 80) : null };
}

export const rotuloCanal = (c: { canal: string | null; pago?: boolean | null }) => (c.canal ? `${c.canal}${c.pago ? ' · anúncio' : ''}` : 'Direto');

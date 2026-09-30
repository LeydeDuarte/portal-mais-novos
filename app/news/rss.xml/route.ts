import { noticiasPublicadas } from '@/lib/news/dados';
import { nomeTopico, textoPuro, urlNoticia } from '@/lib/news/base';
import { SITE_URL } from '@/lib/seo';

// RSS do Mais Novos News (leitores de notícia, agregadores e buscadores)
export const revalidate = 600;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET() {
  const itens = await noticiasPublicadas({ limite: 50 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Mais Novos News</title>
<link>${SITE_URL}/news</link>
<description>Notícias do mercado imobiliário de Goiânia e região.</description>
<language>pt-BR</language>
<atom:link href="${SITE_URL}/news/rss.xml" rel="self" type="application/rss+xml" />
${itens
  .map(
    (n) => `<item>
<title>${esc(n.titulo)}</title>
<link>${SITE_URL}${urlNoticia(n)}</link>
<guid isPermaLink="true">${SITE_URL}${urlNoticia(n)}</guid>
<category>${esc(nomeTopico(n.topico))}</category>
<pubDate>${new Date(n.publicadoEm ?? n.atualizadoEm).toUTCString()}</pubDate>
<description>${esc(n.linhaFina ?? textoPuro(n.corpo).slice(0, 300))}</description>
</item>`
  )
  .join('\n')}
</channel>
</rss>`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}

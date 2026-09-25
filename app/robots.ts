import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { SITE_URL } from '@/lib/seo';
import { ehHostApp } from '@/lib/dominios';

// Buscadores (Google, Bing) e robôs de IA (ChatGPT, Perplexity, Gemini, Claude)
// podem ler as páginas públicas. Painel, APIs, favoritos e links privados ficam fora.
export default function robots(): MetadataRoute.Robots {
  // app.maisnovosimoveis.com (área da equipe): nada é indexado
  if (ehHostApp(headers().get('host'))) return { rules: [{ userAgent: '*', disallow: '/' }] };
  const bloqueado = ['/dashboard', '/painel', '/api/', '/favoritos', '/*?l=', '/*&l='];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: bloqueado },
      { userAgent: ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Google-Extended', 'ClaudeBot', 'Claude-SearchBot', 'Applebot-Extended', 'Bingbot'], allow: '/', disallow: bloqueado }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}

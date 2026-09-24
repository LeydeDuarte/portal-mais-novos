import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Buscadores (Google, Bing) e robôs de IA (ChatGPT, Perplexity, Gemini, Claude)
// podem ler as páginas públicas. Painel, APIs, favoritos e links privados ficam fora.
export default function robots(): MetadataRoute.Robots {
  const bloqueado = ['/painel', '/api/', '/favoritos', '/*?l=', '/*&l='];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: bloqueado },
      { userAgent: ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Google-Extended', 'ClaudeBot', 'Claude-SearchBot', 'Applebot-Extended', 'Bingbot'], allow: '/', disallow: bloqueado }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}

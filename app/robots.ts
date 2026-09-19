import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // O painel é área de trabalho da equipe — não faz sentido pro Google indexar.
        disallow: ['/painel']
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}

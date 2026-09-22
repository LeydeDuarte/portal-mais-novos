import type { MetadataRoute } from 'next';
import { getAllPropertyIds, getAllDevelopmentIds } from '@/lib/actions';
import { SITE_URL } from '@/lib/seo';

// Mesmo motivo do /lancamentos — o sitemap precisa refletir os cadastros
// mais recentes, não ficar congelado no que existia no momento do build.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/lancamentos`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/financiamento`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/news`, changeFrequency: 'weekly', priority: 0.3 }
  ];

  const [propertyIds, developmentIds] = await Promise.all([getAllPropertyIds(), getAllDevelopmentIds()]);

  const propertyPages: MetadataRoute.Sitemap = propertyIds.map((id) => ({
    url: `${SITE_URL}/imovel/${id}`,
    changeFrequency: 'weekly',
    priority: 0.7
  }));

  const developmentPages: MetadataRoute.Sitemap = developmentIds.map((id) => ({
    url: `${SITE_URL}/empreendimento/${id}`,
    changeFrequency: 'weekly',
    priority: 0.7
  }));

  return [...staticPages, ...propertyPages, ...developmentPages];
}

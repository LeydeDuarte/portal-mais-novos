import type { MetadataRoute } from 'next';
import { BASE_PROPERTIES_FOR_SITEMAP, DEVELOPMENTS } from '@/lib/property-details';
import { SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/lancamentos`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/financiamento`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/news`, changeFrequency: 'weekly', priority: 0.3 }
  ];

  const propertyPages: MetadataRoute.Sitemap = BASE_PROPERTIES_FOR_SITEMAP.map((p) => ({
    url: `${SITE_URL}/imovel/${p.id}`,
    changeFrequency: 'weekly',
    priority: 0.7
  }));

  const developmentPages: MetadataRoute.Sitemap = DEVELOPMENTS.map((d) => ({
    url: `${SITE_URL}/empreendimento/${d.id}`,
    changeFrequency: 'weekly',
    priority: 0.7
  }));

  return [...staticPages, ...propertyPages, ...developmentPages];
}

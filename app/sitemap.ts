import type { MetadataRoute } from 'next';
import { SITE_URL, urlRegiao } from '@/lib/seo';
import { listarRegioes, urlsParaSitemap } from '@/lib/landing';

// Mapa do site para o Google: páginas fixas, regiões (cidade/bairro/categoria),
// anúncios públicos e condomínios publicados. Privados, vendidos e rascunhos ficam fora.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agora = new Date();
  const fixas: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: agora, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/lancamentos`, lastModified: agora, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/imoveis-a-venda`, lastModified: agora, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/vender`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/quem-somos`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/financiamento`, changeFrequency: 'monthly', priority: 0.5 }
  ];

  const [regioes, { imoveis, condominios }] = await Promise.all([listarRegioes().catch(() => []), urlsParaSitemap().catch(() => ({ imoveis: [], condominios: [] }))]);

  const paginasRegiao: MetadataRoute.Sitemap = regioes.flatMap((r) => {
    const base = `${SITE_URL}${urlRegiao({ uf: r.uf, cidade: r.cidade, bairro: r.bairro })}`;
    return [
      { url: base, lastModified: agora, changeFrequency: 'daily' as const, priority: r.bairro ? 0.8 : 0.9 },
      ...Object.keys(r.categorias).map((c) => ({ url: `${base}/${c}`, lastModified: agora, changeFrequency: 'daily' as const, priority: 0.7 }))
    ];
  });

  return [
    ...fixas,
    ...paginasRegiao,
    ...imoveis.map((i) => ({ url: `${SITE_URL}/imovel/${i.id}`, lastModified: new Date(i.em), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...condominios.map((c) => ({ url: `${SITE_URL}/empreendimento/${c.id}`, lastModified: new Date(c.em), changeFrequency: 'weekly' as const, priority: 0.6 }))
  ];
}

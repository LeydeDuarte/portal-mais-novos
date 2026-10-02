import { SERIES } from '@/lib/indicadores';
import type { MetadataRoute } from 'next';
import { SITE_URL, urlRegiao } from '@/lib/seo';
import { MIN_QUARTOS, listarRegioes, urlsParaSitemap } from '@/lib/landing';
import { urlImovel, urlCondominio } from '@/lib/urls';
import { query } from '@/lib/db';
import { regioesComNoticias, urlsNoticiasSitemap } from '@/lib/news/dados';
import { TOPICOS, urlRegiao as urlRegiaoNews } from '@/lib/news/base';

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
    { url: `${SITE_URL}/empresas`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/quem-somos`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/financiamento`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/news`, lastModified: agora, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/news/indicadores`, lastModified: agora, changeFrequency: 'daily', priority: 0.7 },
    // uma página por indicador (Selic, IPCA, INCC-DI, INCC-M, IGP-M)
    ...SERIES.map((s) => ({ url: `${SITE_URL}/news/indicadores/${s.id}`, lastModified: agora, changeFrequency: 'daily' as const, priority: 0.7 })),
    { url: `${SITE_URL}/news/incorporadoras`, lastModified: agora, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/avaliar`, lastModified: agora, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/mapa`, lastModified: agora, changeFrequency: 'daily', priority: 0.8 },
    ...TOPICOS.map((t) => ({ url: `${SITE_URL}/news/${t.id}`, lastModified: agora, changeFrequency: 'daily' as const, priority: 0.7 }))
  ];

  const [regioes, { imoveis, condominios }, empresas, noticias, regioesNews] = await Promise.all([
    listarRegioes().catch(() => []),
    urlsParaSitemap().catch(() => ({ imoveis: [], condominios: [] })),
    query<{ slug: string; em: Date }>(
      `select e.slug, e.updated_at as em from empresas e where exists (select 1 from development_empresas de join developments d on d.id = de.development_id where de.empresa_id = e.id and d.status = 'publicado')`
    ).catch(() => []),
    urlsNoticiasSitemap(),
    regioesComNoticias()
  ]);

  const paginasRegiao: MetadataRoute.Sitemap = regioes.flatMap((r) => {
    const base = `${SITE_URL}${urlRegiao({ uf: r.uf, cidade: r.cidade, bairro: r.bairro })}`;
    return [
      { url: base, lastModified: agora, changeFrequency: 'daily' as const, priority: r.bairro ? 0.8 : 0.9 },
      ...Object.keys(r.categorias).map((c) => ({ url: `${base}/${c}`, lastModified: agora, changeFrequency: 'daily' as const, priority: 0.7 })),
      // "apartamento de 3 quartos no Setor Bueno": só com 2+ anúncios
      ...Object.entries(r.quartos ?? {}).flatMap(([c, m]) =>
        Object.entries(m)
          .filter(([, n]) => n >= MIN_QUARTOS)
          .map(([q]) => ({ url: `${base}/${c}/${q}-quartos`, lastModified: agora, changeFrequency: 'daily' as const, priority: 0.7 }))
      )
    ];
  });

  const paginasEmpresas: MetadataRoute.Sitemap = empresas.map((e) => ({ url: `${SITE_URL}/empresa/${e.slug}`, lastModified: new Date(e.em), changeFrequency: 'weekly', priority: 0.6 }));
  return [
    ...fixas,
    ...paginasRegiao,
    ...paginasEmpresas,
    ...noticias.map((n) => ({ url: `${SITE_URL}/news/${n.topico}/${n.slug}`, lastModified: new Date(n.em), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...regioesNews.map((r) => ({ url: `${SITE_URL}${urlRegiaoNews(r.uf, r.cidade)}`, lastModified: agora, changeFrequency: 'daily' as const, priority: 0.6 })),
    ...imoveis.map((i) => ({ url: `${SITE_URL}${urlImovel(i)}`, lastModified: new Date(i.em), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...condominios.map((c) => ({ url: `${SITE_URL}${urlCondominio(c)}`, lastModified: new Date(c.em), changeFrequency: 'weekly' as const, priority: 0.6 }))
  ];
}

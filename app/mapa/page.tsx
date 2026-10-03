import type { Metadata } from 'next';
import Link from 'next/link';
import MapaPublico from '@/components/mapa/MapaPublico';
import JsonLd from '@/components/JsonLd';
import { listarRegioes } from '@/lib/landing';
import { SITE_NAME, SITE_URL, urlRegiao } from '@/lib/seo';
import { imagemCartao } from '@/lib/cartao-og';

const TITULO = 'Mapa de imóveis e lançamentos em Goiânia';
const DESCRICAO =
  'Mapa interativo dos lançamentos, prédios novos, condomínios e imóveis à venda em Goiânia e região, com preço em cada ponto, fase da obra, construtora e a posição do sol de cada prédio.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  alternates: { canonical: '/mapa' },
  openGraph: { title: `${TITULO} | ${SITE_NAME}`, description: DESCRICAO, url: `${SITE_URL}/mapa`, type: 'website', images: imagemCartao({ titulo: 'Imóveis e condomínios no mapa', sub: 'Goiânia e região, com a posição do sol em cada condomínio' }).images },
  twitter: imagemCartao({ titulo: 'Imóveis e condomínios no mapa', sub: 'Goiânia e região, com a posição do sol em cada condomínio' }).twitter
};

export default async function MapaPage() {
  // bairros com anúncio: links que os buscadores e as IAs leem (o mapa em si é desenhado no navegador)
  const regioes = await listarRegioes().catch(() => []);
  const bairros = regioes
    .filter((r) => r.bairro)
    .sort((a, b) => b.n + b.condominios - (a.n + a.condominios))
    .slice(0, 60);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/mapa#pagina`,
        url: `${SITE_URL}/mapa`,
        name: TITULO,
        description: DESCRICAO,
        isPartOf: { '@id': `${SITE_URL}/#site` },
        inLanguage: 'pt-BR',
        mainEntity: { '@id': `${SITE_URL}/mapa#mapa` }
      },
      {
        '@type': 'Map',
        '@id': `${SITE_URL}/mapa#mapa`,
        name: TITULO,
        mapType: 'https://schema.org/VenueMap',
        url: `${SITE_URL}/mapa`,
        spatialCoverage: { '@type': 'Place', name: 'Goiânia e região metropolitana, Goiás, Brasil' },
        provider: { '@id': `${SITE_URL}/#empresa` }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Mapa', item: `${SITE_URL}/mapa` }
        ]
      }
    ]
  };
  return (
    <>
      <JsonLd data={jsonLd} />
      <main id="conteudo">
        <h1 className="sr-only">{TITULO}</h1>
        <MapaPublico />
        {/* lido pelo Google e pelas IAs; fica fora da tela para quem usa o mapa */}
        <section className="sr-only" aria-label="Imóveis por bairro">
          <p>{DESCRICAO}</p>
          <h2>Imóveis à venda por bairro no mapa</h2>
          <ul>
            {bairros.map((b) => (
              <li key={`${b.uf}-${b.cidade}-${b.bairro}`}>
                <Link href={urlRegiao({ uf: b.uf, cidade: b.cidade, bairro: b.bairro })}>
                  Imóveis à venda no {b.bairro}, {b.cidade}
                </Link>{' '}
                <Link href={`/mapa?bairro=${encodeURIComponent(b.bairro!)}&cidade=${encodeURIComponent(b.cidade)}&uf=${b.uf}`}>(ver no mapa)</Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

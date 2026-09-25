import type { Metadata } from 'next';
import Home from '@/components/Home';
import JsonLd from '@/components/JsonLd';
import { buildAgentJsonLd, SITE_NAME, SITE_URL } from '@/lib/seo';
import { montarFeedInicial } from '@/lib/feed-inicial';

export const metadata: Metadata = {
  title: { absolute: `Imóveis à venda em Goiânia com vídeo | ${SITE_NAME}` },
  description:
    'Apartamentos, casas em condomínio, coberturas e lançamentos à venda em Goiânia, com fotos e vídeos. Busque por bairro, condomínio e preço, com crédito imobiliário especializado.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: `Imóveis à venda em Goiânia com vídeo | ${SITE_NAME}`,
    description: 'O feed de imóveis mais bonito de Goiânia: apartamentos, casas em condomínio e lançamentos com vídeo.',
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512, alt: SITE_NAME }]
  }
};

export default async function Page({ searchParams }: { searchParams: { q?: string } }) {
  const q = typeof searchParams?.q === 'string' ? searchParams.q.slice(0, 120) : '';
  const inicial = await montarFeedInicial('todos', q);
  return (
    <>
      <JsonLd data={buildAgentJsonLd()} />
      <h1 className="sr-only">Imóveis à venda em Goiânia: apartamentos, casas em condomínio, coberturas e lançamentos com vídeo</h1>
      <Home initialQuery={q} inicial={inicial} />
    </>
  );
}

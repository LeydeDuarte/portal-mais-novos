import type { Metadata } from 'next';
import Home from '@/components/Home';
import JsonLd from '@/components/JsonLd';
import { buildAgentJsonLd, SITE_NAME, SITE_URL } from '@/lib/seo';
import { montarFeedInicial } from '@/lib/feed-inicial';
import { preloadPrimeirasFotos } from '@/lib/preload-feed';
import { TITULO_HOME } from '@/lib/titulos';
import { imagemCartao, CARTAO_PADRAO } from '@/lib/cartao-og';

export const metadata: Metadata = {
  title: { absolute: TITULO_HOME },
  description:
    'Os Mais Novos Imóveis à venda em Goiânia: lançamentos, apartamentos e casas em condomínio prontos para morar. Busque por bairro, condomínio e preço.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITULO_HOME,
    description: 'Lançamentos, apartamentos e casas em condomínio à venda em Goiânia, com fotos, plantas e atendimento especializado em crédito imobiliário.',
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'pt_BR',
    type: 'website', images: imagemCartao(CARTAO_PADRAO).images },
  twitter: imagemCartao(CARTAO_PADRAO).twitter
};

export default async function Page({ searchParams }: { searchParams: { q?: string } }) {
  const q = typeof searchParams?.q === 'string' ? searchParams.q.slice(0, 120) : '';
  const inicial = await montarFeedInicial('todos', q);
  preloadPrimeirasFotos([...(inicial.destaques ?? []).slice(0, 1), ...inicial.items], 3);
  return (
    <>
      <JsonLd data={buildAgentJsonLd()} />
      <h1 className="sr-only">Os Mais Novos Imóveis à Venda estão aqui: lançamentos, apartamentos e casas em condomínio em Goiânia</h1>
      <main id="conteudo">
        <Home initialQuery={q} inicial={inicial} />
      </main>
    </>
  );
}

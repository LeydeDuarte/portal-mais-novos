import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import IndicadoresView from '@/components/news/IndicadoresView';
import { serieValida } from '@/lib/indicadores';
import { SITE_URL } from '@/lib/seo';

// Visão geral dos indicadores. Cada índice tem a sua própria página
// (/news/indicadores/selic etc.); o endereço antigo com ?serie= redireciona para ela.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: 'Selic, IPCA, INCC e IGP-M Hoje: Gráfico e Histórico' },
  description: 'Selic, IPCA, INCC-DI, INCC-M e IGP-M atualizados todo mês com dados do Banco Central, com gráfico e o que cada índice muda no seu imóvel.',
  alternates: { canonical: `${SITE_URL}/news/indicadores` }
};

export default async function IndicadoresPage({ searchParams }: { searchParams: { serie?: string; periodo?: string } }) {
  if (searchParams.serie && serieValida(searchParams.serie)) {
    permanentRedirect(`/news/indicadores/${searchParams.serie}${searchParams.periodo ? `?periodo=${encodeURIComponent(searchParams.periodo)}` : ''}`);
  }
  return <IndicadoresView serieId="incc-di" periodoId={searchParams.periodo} porSerie={false} />;
}

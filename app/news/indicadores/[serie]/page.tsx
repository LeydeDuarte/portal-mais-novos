import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import IndicadoresView from '@/components/news/IndicadoresView';
import { lerIndicadores, mesAno, pct, serieValida, SERIES, type SerieId } from '@/lib/indicadores';
import { SITE_URL } from '@/lib/seo';

// Uma página por indicador, para cada um aparecer sozinho no Google
// ("Selic hoje", "IGP-M hoje", "INCC-DI acumulado" etc.).
export const revalidate = 3600;

export function generateStaticParams() {
  return SERIES.map((s) => ({ serie: s.id }));
}

const TITULO: Record<SerieId, string> = {
  selic: 'Selic Hoje: Taxa Atual do Copom, Gráfico e Histórico',
  ipca: 'IPCA Hoje: Inflação do Mês, Acumulado em 12 Meses e Calculadora',
  'incc-di': 'INCC-DI Hoje: Índice do Mês, Acumulado e Calculadora de Parcelas',
  'incc-m': 'INCC-M Hoje: Índice do Mês, Acumulado em 12 Meses e Calculadora',
  igpm: 'IGP-M Hoje: Índice do Aluguel, Acumulado em 12 Meses e Calculadora'
};

export async function generateMetadata({ params }: { params: { serie: string } }): Promise<Metadata> {
  if (!serieValida(params.serie)) return {};
  const cfg = SERIES.find((s) => s.id === params.serie)!;
  const atual = (await lerIndicadores(13).catch(() => [])).find((i) => i.id === params.serie);
  const agora = atual
    ? params.serie === 'selic'
      ? `Selic em ${pct(atual.valor)} ao ano (${mesAno(atual.data)}). `
      : `${cfg.nome} de ${mesAno(atual.data)}: ${pct(atual.valor)}${atual.acumulado12 != null ? `, ${pct(atual.acumulado12)} em 12 meses` : ''}. `
    : '';
  const description = `${agora}${cfg.explica} Gráfico de 12 meses a 10 anos com dados do Banco Central.`.slice(0, 300);
  const url = `${SITE_URL}/news/indicadores/${params.serie}`;
  return {
    title: { absolute: TITULO[params.serie] },
    description,
    alternates: { canonical: url },
    openGraph: { title: TITULO[params.serie], description, url, type: 'website' }
  };
}

export default function IndicadorPage({ params, searchParams }: { params: { serie: string }; searchParams: { periodo?: string } }) {
  if (!serieValida(params.serie)) notFound();
  return <IndicadoresView serieId={params.serie} periodoId={searchParams.periodo} porSerie />;
}

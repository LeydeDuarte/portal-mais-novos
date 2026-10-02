import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Listagem from '@/components/news/Listagem';
import { noticiasPublicadas } from '@/lib/news/dados';
import { nomeTopico, topicoValido } from '@/lib/news/base';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 300;
const POR_PAGINA = 20;
const DESCRICOES: Record<string, string> = {
  mercado: 'O que está acontecendo com os preços, as vendas e os lançamentos em Goiânia e região, com números de verdade.',
  bairros: 'Bairro por bairro: quanto custa o m², o que está à venda e o que muda na vizinhança.',
  lancamentos: 'Lançamentos e empreendimentos em obra: prazos, plantas, preços e o que vale a pena olhar.',
  financiamento: 'Juros, entrada, FGTS, portabilidade e home equity, explicados sem economês.',
  'comprar-e-vender': 'Documentação, negociação, taxas e os erros que custam caro na compra e na venda de imóvel.',
  investimento: 'Aluguel, valorização e renda com imóveis: onde o dinheiro trabalha e onde ele dorme.',
  curiosidades: 'Histórias da cidade, dos bairros e do mercado que ninguém te contou.',
  'direito-imobiliario': 'Contratos, distrato, condomínio, inventário e usucapião, em português claro.',
  'manchetes-da-semana': 'Todo sábado de manhã: o que aconteceu no Brasil e no mundo na semana e o que isso muda para quem compra, vende ou financia imóvel.'
};

export async function generateMetadata({ params }: { params: { topico: string } }): Promise<Metadata> {
  if (!topicoValido(params.topico)) return { title: 'News' };
  const nome = nomeTopico(params.topico);
  return {
    title: {
      absolute:
        params.topico === 'manchetes-da-semana'
          ? 'Manchetes da Semana do Mercado Imobiliário | Mais Novos News'
          : `${nome}: Notícias do Mercado Imobiliário | Mais Novos News`
    },
    description: DESCRICOES[params.topico],
    alternates: { canonical: `${SITE_URL}/news/${params.topico}` }
  };
}

export default async function TopicoPage({ params, searchParams }: { params: { topico: string }; searchParams: { pagina?: string } }) {
  if (!topicoValido(params.topico)) notFound();
  const pagina = Math.max(0, (Number(searchParams.pagina) || 1) - 1);
  const itens = await noticiasPublicadas({ topico: params.topico, limite: POR_PAGINA + 1, pagina });
  return (
    <Listagem
      titulo={nomeTopico(params.topico)}
      descricao={DESCRICOES[params.topico]}
      itens={itens.slice(0, POR_PAGINA)}
      temMais={itens.length > POR_PAGINA}
      ativo={params.topico}
      caminho={`/news/${params.topico}`}
      pagina={pagina}
    />
  );
}

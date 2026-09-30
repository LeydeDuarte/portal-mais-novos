import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Listagem from '@/components/news/Listagem';
import { cidadePorSlug, noticiasPublicadas } from '@/lib/news/dados';
import { UFS, urlRegiao } from '@/lib/news/base';
import { SITE_URL } from '@/lib/seo';

// "Novidades do mercado imobiliário em Goiânia" / "... em Santa Catarina": cada estado
// e cidade ganha a sua página assim que a primeira notícia de lá é publicada.
export const revalidate = 300;
const POR_PAGINA = 20;
type Props = { params: { uf: string; cidade?: string[] }; searchParams: { pagina?: string } };

async function resolver(params: Props['params']) {
  const uf = params.uf.toUpperCase();
  if (!UFS[uf]) return null;
  const cidade = params.cidade?.[0] ? await cidadePorSlug(uf, params.cidade[0]) : null;
  if (params.cidade?.[0] && !cidade) return null;
  return { uf, cidade, lugar: cidade ?? UFS[uf] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolver(params);
  if (!r) return { title: 'News' };
  return {
    title: { absolute: `Novidades do Mercado Imobiliário em ${r.lugar}${r.cidade ? `/${r.uf}` : ''}` },
    description: `Notícias, lançamentos, preço do m² e novidades do mercado imobiliário em ${r.lugar}${r.cidade ? `, ${UFS[r.uf]}` : ''}.`,
    alternates: { canonical: `${SITE_URL}${urlRegiao(r.uf, r.cidade)}` }
  };
}

export default async function RegiaoPage({ params, searchParams }: Props) {
  const r = await resolver(params);
  if (!r) notFound();
  const pagina = Math.max(0, (Number(searchParams.pagina) || 1) - 1);
  const itens = await noticiasPublicadas({ uf: r.uf, cidade: r.cidade ?? undefined, limite: POR_PAGINA + 1, pagina });
  return (
    <Listagem
      titulo={`Novidades do mercado imobiliário em ${r.lugar}`}
      descricao={`Tudo o que publicamos sobre ${r.lugar}${r.cidade ? ` (${UFS[r.uf]})` : ''}: lançamentos, preços, bairros e o que muda para quem compra, vende ou investe.`}
      itens={itens.slice(0, POR_PAGINA)}
      temMais={itens.length > POR_PAGINA}
      regiaoAtual={r.cidade ? `${r.uf}/${r.cidade}` : r.uf}
      caminho={urlRegiao(r.uf, r.cidade)}
      pagina={pagina}
    />
  );
}

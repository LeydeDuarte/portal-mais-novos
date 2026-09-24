import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PropertyDetailView from '@/components/PropertyDetailView';
import OcultoView from '@/components/OcultoView';
import { getPropertyById, getResumoOculto, getStaffSession } from '@/lib/actions';
import { buildPropertyMetadata, buildPropertyJsonLd, SITE_URL } from '@/lib/seo';
import { tituloOculto, brlCurto } from '@/lib/ocultos';

// Sempre busca os dados na hora: assim uma edição feita no painel aparece
// imediatamente (sem isso, o Next guardava a primeira versão da página).
export const dynamic = 'force-dynamic';

type Props = { params: { id: string }; searchParams: { k?: string } };

// Anúncio PRIVADO: equipe logada e quem tem o link privado (?k=...) veem o
// anúncio completo (fora do Google); o público vê só o resumo + "peça para ver".
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const property = await getPropertyById(params.id, searchParams.k);
  if (property) {
    const meta = buildPropertyMetadata(property);
    return property.visibilidade === 'privado' ? { ...meta, robots: { index: false, follow: false } } : meta;
  }
  const a = await getResumoOculto(params.id);
  if (!a) return { title: 'Imóvel — Mais Novos Imóveis' };
  const t = tituloOculto(a);
  return {
    title: `${t} — anúncio reservado | Mais Novos Imóveis`,
    description: `${t}${a.preco ? `, ${brlCurto(a.preco)}` : ''}. Anúncio reservado pelo proprietário — solicite as fotos e o endereço com a Mais Novos Imóveis.`,
    alternates: { canonical: `${SITE_URL}/imovel/${params.id}` }
  };
}

// Sem generateStaticParams — o catálogo vive no banco e muda o tempo todo,
// então cada página é renderizada sob demanda (o HTML sai completo pro Google).
export default async function ImovelPage({ params, searchParams }: Props) {
  const property = await getPropertyById(params.id, searchParams.k);
  if (!property) {
    const a = await getResumoOculto(params.id);
    if (!a) notFound();
    return <OcultoView a={a} />;
  }

  if (property.visibilidade === 'privado') {
    const staff = await getStaffSession();
    return <PropertyDetailView property={property} avisoPrivado={staff ? 'completo' : 'link'} />;
  }

  const jsonLd = buildPropertyJsonLd(property);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PropertyDetailView property={property} />
    </>
  );
}

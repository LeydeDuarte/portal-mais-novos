import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import PropertyDetailView from '@/components/PropertyDetailView';
import OcultoView from '@/components/OcultoView';
import AtivarLinkPrivado from '@/components/AtivarLinkPrivado';
import ProtecaoTela from '@/components/ProtecaoTela';
import { getPropertyById, getResumoOculto, getStaffSession } from '@/lib/actions';
import { verificarLinkPrivado } from '@/lib/links-privados';
import { buildPropertyMetadata, buildPropertyJsonLd, SITE_URL } from '@/lib/seo';
import { tituloOculto, brlCurto } from '@/lib/ocultos';

// Sempre busca os dados na hora: assim uma edição feita no painel aparece
// imediatamente (sem isso, o Next guardava a primeira versão da página).
export const dynamic = 'force-dynamic';

type Props = { params: { id: string }; searchParams: { l?: string } };

// Anúncio PRIVADO: a equipe logada vê completo; o cliente só vê completo pelo
// link pessoal (?l=...) e só no(s) aparelho(s) em que o link foi aberto primeiro.
// O público (e o Google) vê só o resumo, sem fotos nem endereço.
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const property = await getPropertyById(params.id);
  if (property) {
    const meta = buildPropertyMetadata(property);
    return property.visibilidade === 'privado' ? { ...meta, robots: { index: false, follow: false } } : meta;
  }
  const a = await getResumoOculto(params.id);
  if (!a) return { title: 'Imóvel — Mais Novos Imóveis' };
  const t = tituloOculto(a);
  return {
    title: `${t} — anúncio privado | Mais Novos Imóveis`,
    description: `${t}${a.preco ? `, ${brlCurto(a.preco)}` : ''}. Anúncio privado — solicite as fotos e o endereço com a Mais Novos Imóveis.`,
    alternates: { canonical: `${SITE_URL}/imovel/${params.id}` },
    ...(searchParams.l ? { robots: { index: false, follow: false } } : {})
  };
}

// Sem generateStaticParams — o catálogo vive no banco e muda o tempo todo,
// então cada página é renderizada sob demanda (o HTML sai completo pro Google).
export default async function ImovelPage({ params, searchParams }: Props) {
  const property = await getPropertyById(params.id);
  if (!property) {
    const a = await getResumoOculto(params.id);
    if (!a) notFound();
    if (searchParams.l) {
      const r = await verificarLinkPrivado(params.id, searchParams.l);
      if (r.estado === 'ok') {
        return (
          <>
            <ProtecaoTela />
            <PropertyDetailView property={r.property} avisoPrivado="link" marcaDagua={r.marcaDagua} />
          </>
        );
      }
      if (r.estado === 'ativar') {
        return (
          <div className="flex min-h-screen flex-col">
            <Header />
            <AtivarLinkPrivado propertyId={params.id} linkId={searchParams.l} />
          </div>
        );
      }
      return <OcultoView a={a} bloqueado={r.estado === 'bloqueado'} />;
    }
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

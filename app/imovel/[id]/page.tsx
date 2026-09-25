import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { resolverImovel } from '@/lib/slug-resolver';
import Header from '@/components/Header';
import PropertyDetailView from '@/components/PropertyDetailView';
import OcultoView from '@/components/OcultoView';
import AtivarLinkPrivado from '@/components/AtivarLinkPrivado';
import ProtecaoTela from '@/components/ProtecaoTela';
import { cache } from 'react';
import { getPropertyById as buscarImovel, getResumoOculto as buscarResumo, getStaffSession } from '@/lib/actions';

// Uma consulta só por página (os metadados e a página usam o mesmo resultado)
// o endereço pode ser o nome (slug) ou o código antigo: tudo vira o id aqui
const resolver = cache((param: string) => resolverImovel(param));
const getPropertyById = cache(async (param: string) => {
  const r = await resolver(param);
  return r ? buscarImovel(r.id) : null;
});
const getResumoOculto = cache(async (param: string) => {
  const r = await resolver(param);
  return r ? buscarResumo(r.id) : null;
});
import { verificarLinkPrivado } from '@/lib/links-privados';
import { buildPropertyMetadata, buildPropertyJsonLd, SITE_URL } from '@/lib/seo';
import { tituloOculto, brlCurto } from '@/lib/ocultos';
import JsonLd from '@/components/JsonLd';

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
  if (!a) return { title: 'Imóvel | Mais Novos Imóveis' };
  const t = tituloOculto(a);
  return {
    title: `${t}, anúncio privado | Mais Novos Imóveis`,
    description: `${t}${a.preco ? `, ${brlCurto(a.preco)}` : ''}. Anúncio privado: solicite as fotos e o endereço com a Mais Novos Imóveis.`,
    alternates: { canonical: `${SITE_URL}/imovel/${(await resolver(params.id))?.id ?? params.id}` },
    ...(searchParams.l ? { robots: { index: false, follow: false } } : {})
  };
}

// Sem generateStaticParams — o catálogo vive no banco e muda o tempo todo,
// então cada página é renderizada sob demanda (o HTML sai completo pro Google).
export default async function ImovelPage({ params, searchParams }: Props) {
  const property = await getPropertyById(params.id);
  // anúncio público aberto pelo código antigo → endereço com o nome (301)
  if (property && property.visibilidade !== 'privado' && property.slug && property.slug !== decodeURIComponent(params.id) && !searchParams.l) {
    permanentRedirect(`/imovel/${property.slug}`);
  }
  if (!property) {
    const a = await getResumoOculto(params.id);
    if (!a) notFound();
    if (searchParams.l) {
      const r = await verificarLinkPrivado(a.id, searchParams.l);
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
            <AtivarLinkPrivado propertyId={a.id} linkId={searchParams.l} />
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
      <JsonLd data={jsonLd} />
      <PropertyDetailView property={property} />
    </>
  );
}

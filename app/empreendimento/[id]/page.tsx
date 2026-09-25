import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { destinoDoMesclado } from '@/lib/duplicados';
import DevelopmentDetailView from '@/components/DevelopmentDetailView';
import { cache } from 'react';
import { getDevelopmentById as buscarCondominio } from '@/lib/actions';

import { resolverCondominio } from '@/lib/slug-resolver';

// o endereço pode ser o nome (slug) ou o código antigo
const resolver = cache((param: string) => resolverCondominio(param));
const getDevelopmentById = cache(async (param: string) => {
  const r = await resolver(param);
  return r ? buscarCondominio(r.id) : null;
});
import { buildDevelopmentMetadata, buildDevelopmentJsonLd } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';

// Sempre busca os dados na hora: assim uma edição feita no painel aparece
// imediatamente (sem isso, o Next guardava a primeira versão da página).
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const development = await getDevelopmentById(params.id);
  if (!development) return { title: 'Empreendimento | Mais Novos Imóveis' };
  return buildDevelopmentMetadata(development);
}

export default async function EmpreendimentoPage({ params }: { params: { id: string } }) {
  const development = await getDevelopmentById(params.id);
  if (!development) {
    // condomínio que foi juntado a outro: o endereço antigo leva para o que ficou
    const novo = await destinoDoMesclado(params.id);
    if (novo) permanentRedirect(`/empreendimento/${novo}`);
    notFound();
  }
  // aberto pelo código antigo → endereço com o nome do condomínio (301)
  if (development.slug && development.slug !== decodeURIComponent(params.id)) permanentRedirect(`/empreendimento/${development.slug}`);

  const jsonLd = buildDevelopmentJsonLd(development);
  return (
    <>
      <JsonLd data={jsonLd} />
      <DevelopmentDetailView development={development} />
    </>
  );
}

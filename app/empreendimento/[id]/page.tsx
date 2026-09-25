import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { destinoDoMesclado } from '@/lib/duplicados';
import DevelopmentDetailView from '@/components/DevelopmentDetailView';
import { cache } from 'react';
import { getDevelopmentById as buscarCondominio } from '@/lib/actions';

const getDevelopmentById = cache((id: string) => buscarCondominio(id));
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

  const jsonLd = buildDevelopmentJsonLd(development);
  return (
    <>
      <JsonLd data={jsonLd} />
      <DevelopmentDetailView development={development} />
    </>
  );
}

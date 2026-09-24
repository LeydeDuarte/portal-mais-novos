import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { destinoDoMesclado } from '@/lib/duplicados';
import DevelopmentDetailView from '@/components/DevelopmentDetailView';
import { getDevelopmentById } from '@/lib/actions';
import { buildDevelopmentMetadata, buildDevelopmentJsonLd } from '@/lib/seo';

// Sempre busca os dados na hora: assim uma edição feita no painel aparece
// imediatamente (sem isso, o Next guardava a primeira versão da página).
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const development = await getDevelopmentById(params.id);
  if (!development) return { title: 'Empreendimento — Mais Novos Imóveis' };
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DevelopmentDetailView development={development} />
    </>
  );
}

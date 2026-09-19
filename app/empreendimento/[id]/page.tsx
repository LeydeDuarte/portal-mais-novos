import type { Metadata } from 'next';
import DevelopmentDetailView from '@/components/DevelopmentDetailView';
import CreatedDevelopmentFallback from '@/components/CreatedDevelopmentFallback';
import { getDevelopment, DEVELOPMENTS } from '@/lib/property-details';
import { buildDevelopmentMetadata, buildDevelopmentJsonLd } from '@/lib/seo';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const development = getDevelopment(params.id);
  if (!development) return { title: 'Empreendimento — Mais Novos Imóveis' };
  return buildDevelopmentMetadata(development);
}

export function generateStaticParams() {
  return DEVELOPMENTS.map((d) => ({ id: d.id }));
}

export default function EmpreendimentoPage({ params }: { params: { id: string } }) {
  const development = getDevelopment(params.id);

  if (development) {
    const jsonLd = buildDevelopmentJsonLd(development);
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <DevelopmentDetailView development={development} />
      </>
    );
  }

  return <CreatedDevelopmentFallback id={params.id} />;
}

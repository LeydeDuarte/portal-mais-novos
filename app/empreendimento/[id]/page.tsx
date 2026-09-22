import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DevelopmentDetailView from '@/components/DevelopmentDetailView';
import { getDevelopmentById } from '@/lib/actions';
import { buildDevelopmentMetadata, buildDevelopmentJsonLd } from '@/lib/seo';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const development = await getDevelopmentById(params.id);
  if (!development) return { title: 'Empreendimento — Mais Novos Imóveis' };
  return buildDevelopmentMetadata(development);
}

export default async function EmpreendimentoPage({ params }: { params: { id: string } }) {
  const development = await getDevelopmentById(params.id);
  if (!development) notFound();

  const jsonLd = buildDevelopmentJsonLd(development);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DevelopmentDetailView development={development} />
    </>
  );
}

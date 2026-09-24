import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PropertyDetailView from '@/components/PropertyDetailView';
import { getPropertyById } from '@/lib/actions';
import { buildPropertyMetadata, buildPropertyJsonLd } from '@/lib/seo';

// Sempre busca os dados na hora: assim uma edição feita no painel aparece
// imediatamente (sem isso, o Next guardava a primeira versão da página).
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const property = await getPropertyById(params.id);
  if (!property) return { title: 'Imóvel — Mais Novos Imóveis' };
  return buildPropertyMetadata(property);
}

// Sem generateStaticParams — o catálogo agora vive no banco de dados e muda
// o tempo todo (novos cadastros), então cada página é renderizada sob
// demanda (SSR), não pré-gerada no build. O HTML ainda sai completo pro
// Google, só não fica congelado desde o momento do deploy.
export default async function ImovelPage({ params }: { params: { id: string } }) {
  const property = await getPropertyById(params.id);
  if (!property) notFound();

  const jsonLd = buildPropertyJsonLd(property);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PropertyDetailView property={property} />
    </>
  );
}

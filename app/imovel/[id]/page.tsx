import type { Metadata } from 'next';
import PropertyDetailView from '@/components/PropertyDetailView';
import CreatedPropertyFallback from '@/components/CreatedPropertyFallback';
import { getPropertyDetail, BASE_PROPERTIES_FOR_SITEMAP } from '@/lib/property-details';
import { buildPropertyMetadata, buildPropertyJsonLd } from '@/lib/seo';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const property = getPropertyDetail(params.id);
  if (!property) return { title: 'Imóvel — Mais Novos Imóveis' };
  return buildPropertyMetadata(property);
}

// Pré-gera as páginas de todo o catálogo estático no build — cada imóvel de
// exemplo já sai pronto como HTML, sem esperar nenhuma requisição na hora
// que o Google (ou uma pessoa) acessa.
export function generateStaticParams() {
  return BASE_PROPERTIES_FOR_SITEMAP.map((p) => ({ id: p.id }));
}

export default function ImovelPage({ params }: { params: { id: string } }) {
  const property = getPropertyDetail(params.id);

  // Imóvel do catálogo de exemplo: renderizado no servidor, com dados
  // estruturados — é o caminho que o Google consegue indexar de verdade.
  if (property) {
    const jsonLd = buildPropertyJsonLd(property);
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <PropertyDetailView property={property} />
      </>
    );
  }

  // Imóvel cadastrado pelo painel: só existe no localStorage de quem
  // cadastrou, então a busca acontece no navegador (ver componente).
  return <CreatedPropertyFallback id={params.id} />;
}

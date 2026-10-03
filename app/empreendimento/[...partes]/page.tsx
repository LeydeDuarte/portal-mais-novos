import { urlCondominio } from '@/lib/urls';
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
import { imagemCartao } from '@/lib/cartao-og';

// Sempre busca os dados na hora: assim uma edição feita no painel aparece
// imediatamente (sem isso, o Next guardava a primeira versão da página).
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params: { partes } }: { params: { partes: string[] } }): Promise<Metadata> {
  const params = { id: partes[partes.length - 1] ?? '' };
  const development = await getDevelopmentById(params.id);
  if (!development) return { title: 'Empreendimento | Mais Novos Imóveis' };
  const meta = buildDevelopmentMetadata(development);
  if ((development.photos ?? []).length) return meta;
  // sem foto: cartão com a logo completa, selo, nome, bairro e entrega (WhatsApp e redes)
  const ano = /^\d{4}/.test(development.deliveryDate ?? '') ? Number(development.deliveryDate.slice(0, 4)) : null;
  const futuro = !!ano && development.deliveryDate > new Date().toISOString().slice(0, 7);
  const onde = [development.bairro, development.cidade].filter(Boolean).join(', ');
  const entrega = ano ? (futuro ? `Entrega em ${ano}` : development.tipo === 'horizontal' ? `Casas desde ${ano}` : `Entregue em ${ano}`) : null;
  const c = imagemCartao({ titulo: development.name, sub: [onde, entrega].filter(Boolean).join(' · ') || null, selo: futuro ? 'Lançamento' : 'Condomínio' });
  return { ...meta, openGraph: { ...meta.openGraph, images: c.images }, twitter: { ...meta.twitter, ...c.twitter } };
}

export default async function EmpreendimentoPage({ params: { partes } }: { params: { partes: string[] } }) {
  const params = { id: partes[partes.length - 1] ?? '' };
  const development = await getDevelopmentById(params.id);
  if (!development) {
    // condomínio que foi juntado a outro: o endereço antigo leva para o que ficou
    const novo = await destinoDoMesclado(params.id);
    if (novo) permanentRedirect(`/empreendimento/${novo}`);
    notFound();
  }
  // aberto pelo código antigo → endereço com o nome do condomínio (301)
  // endereço antigo, pelo código ou sem o bairro → endereço completo com o nome (301)
  const certo = urlCondominio(development);
  if (certo !== `/empreendimento/${partes.map((x) => decodeURIComponent(x)).join('/')}`) permanentRedirect(certo);

  const jsonLd = buildDevelopmentJsonLd(development);
  return (
    <>
      <JsonLd data={jsonLd} />
      <DevelopmentDetailView development={development} />
    </>
  );
}

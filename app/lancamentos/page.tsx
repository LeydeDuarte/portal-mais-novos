import type { Metadata } from 'next';
import Home from '@/components/Home';
import { montarFeedInicial } from '@/lib/feed-inicial';

export const metadata: Metadata = {
  title: 'Lançamentos e imóveis novos em Goiânia',
  description:
    'Lançamentos imobiliários, prédios novos e condomínios em Goiânia: plantas, valores, data de entrega e vídeos. Filtre por bairro, tipo, quartos e preço.',
  alternates: { canonical: '/lancamentos' }
};

// Mesmo feed do Comprar, já filtrado em "Lançamentos e empreendimentos".
export default async function LancamentosPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = typeof searchParams?.q === 'string' ? searchParams.q.slice(0, 120) : '';
  const inicial = await montarFeedInicial('lancamentos', q);
  return (
    <>
      <h1 className="sr-only">Lançamentos e imóveis novos à venda em Goiânia</h1>
      <Home initialModo="lancamentos" initialQuery={q} inicial={inicial} />
    </>
  );
}

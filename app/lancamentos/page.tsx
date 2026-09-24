import type { Metadata } from 'next';
import Home from '@/components/Home';

export const metadata: Metadata = {
  title: 'Lançamentos e empreendimentos em Goiânia',
  description:
    'Lançamentos, empreendimentos e condomínios em Goiânia — filtre por bairro, tipo de imóvel, quartos, preço e ano de entrega.',
  alternates: { canonical: '/lancamentos' }
};

// Mesmo feed do Comprar, já filtrado em "Lançamentos e empreendimentos".
// Os filtros são os mesmos (bairro, tipo, quartos, preço, ano de entrega...).
export default function LancamentosPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = typeof searchParams?.q === 'string' ? searchParams.q.slice(0, 120) : '';
  return <Home initialModo="lancamentos" initialQuery={q} />;
}

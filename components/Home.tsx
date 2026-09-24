'use client';

import { useEffect, useState } from 'react';
import Header from './Header';
import FilterBar from './FilterBar';
import MasonryFeed from './MasonryFeed';
import Footer from './Footer';
import { DEFAULT_FILTERS, type FilterState } from '@/lib/filters';

type Props = {
  initialModo?: FilterState['modo'];
  initialQuery?: string;
};

// Mesmo feed para o Comprar (/) e para Lançamentos (/lancamentos) — a única
// diferença é o modo que já vem marcado. Os filtros são os mesmos nos dois.
export default function Home({ initialModo = 'todos', initialQuery = '' }: Props) {
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS, modo: initialModo, q: initialQuery });

  // Nova busca pelo campo do topo (muda o ?q= da URL) → atualiza o feed
  useEffect(() => {
    setFilters((prev) => (prev.q === initialQuery ? prev : { ...prev, q: initialQuery }));
  }, [initialQuery]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header initialQuery={initialQuery} />
      <FilterBar filters={filters} onChange={setFilters} />
      <MasonryFeed filters={filters} />
      <Footer />
    </div>
  );
}

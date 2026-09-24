'use client';

import { useEffect, useRef, useState } from 'react';
import Header from './Header';
import FilterBar from './FilterBar';
import MasonryFeed, { type FeedInicial } from './MasonryFeed';
import Footer from './Footer';
import SearchBox from './SearchBox';
import { DEFAULT_FILTERS, addTermos, localKey, splitTermos, type FilterState, type LocalFiltro } from '@/lib/filters';

type Props = {
  initialModo?: FilterState['modo'];
  initialQuery?: string;
  inicial?: FeedInicial;
};

const LOCAIS_KEY = 'mn_locais';

// Mesmo feed para o Comprar (/) e para Lançamentos (/lancamentos) — a única
// diferença é o modo que já vem marcado. Os filtros são os mesmos nos dois.
export default function Home({ initialModo = 'todos', initialQuery = '', inicial }: Props) {
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS, modo: initialModo, termos: splitTermos(initialQuery) });
  const carregouLocais = useRef(false);

  // Memória: os locais escolhidos ficam guardados neste navegador e voltam na próxima visita
  useEffect(() => {
    try {
      const salvos = JSON.parse(localStorage.getItem(LOCAIS_KEY) || '[]') as LocalFiltro[];
      if (Array.isArray(salvos) && salvos.length) setFilters((prev) => ({ ...prev, locais: salvos.slice(0, 20) }));
    } catch {
      // sem memória disponível — segue sem locais
    }
    carregouLocais.current = true;
  }, []);
  useEffect(() => {
    if (!carregouLocais.current) return;
    try {
      localStorage.setItem(LOCAIS_KEY, JSON.stringify(filters.locais));
    } catch {
      // ignora
    }
  }, [filters.locais]);

  // Busca vinda de outra página (?q=) → vira balão(ões)
  useEffect(() => {
    const novos = splitTermos(initialQuery);
    if (!novos.length) return;
    setFilters((prev) => {
      const termos = addTermos(prev.termos, novos);
      return termos.length === prev.termos.length ? prev : { ...prev, termos };
    });
  }, [initialQuery]);

  const toggleLocal = (l: LocalFiltro) =>
    setFilters((prev) => {
      const k = localKey(l);
      const tem = prev.locais.some((x) => localKey(x) === k);
      return { ...prev, locais: tem ? prev.locais.filter((x) => localKey(x) !== k) : [...prev.locais, l] };
    });

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        searchSlot={
          <SearchBox
            locais={filters.locais}
            onToggleLocal={toggleLocal}
            onSearchText={(texto) => setFilters((prev) => ({ ...prev, termos: addTermos(prev.termos, splitTermos(texto)) }))}
          />
        }
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <MasonryFeed filters={filters} inicial={inicial} />
      <Footer />
    </div>
  );
}

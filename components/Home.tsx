'use client';

import { useEffect, useRef, useState } from 'react';
import Header from './Header';
import FilterBar from './FilterBar';
import PainelFiltros from './PainelFiltros';
import MasonryFeed, { type FeedInicial } from './MasonryFeed';
import Footer from './Footer';
import SearchBox from './SearchBox';
import Link from 'next/link';
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

  // a mesma busca vale no mapa (/mapa) e de volta no feed
  useEffect(() => {
    try {
      const salvo = JSON.parse(sessionStorage.getItem('mn_filtros_feed') || 'null') as FilterState | null;
      if (salvo && !initialQuery) setFilters((prev) => ({ ...prev, ...salvo, modo: initialModo === 'lancamentos' ? 'lancamentos' : salvo.modo ?? prev.modo }));
    } catch {
      /* sem memória */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem('mn_filtros_feed', JSON.stringify(filters));
    } catch {
      /* ignora */
    }
  }, [filters]);

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
      <div className="flex">
        <PainelFiltros filters={filters} onChange={setFilters} />
        <div className="min-w-0 flex-1">
          <MasonryFeed filters={filters} inicial={inicial} />
        </div>
      </div>
      <Footer />
      {/* atalho para o mapa, com a mesma busca */}
      <Link
        href="/mapa"
        className="fixed bottom-6 left-1/2 z-[60] flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-[#14161A] px-5 text-[13.5px] font-semibold text-white shadow-lg hover:brightness-110"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
        Ver no mapa
      </Link>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildFeedPage } from '@/lib/property-details';
import type { Property } from '@/lib/mock-properties';
import { matchesFilters, type FilterState } from '@/lib/filters';
import { useFavorites } from '@/lib/use-favorites';
import { useSession } from '@/lib/use-session';
import { useCreatedProperties } from '@/lib/use-created-properties';
import PropertyCard from './PropertyCard';
import LoginModal from './LoginModal';

const PAGE_SIZE = 12;
const MAX_CYCLES = 8; // limite só do protótipo — a API real simplesmente para de retornar itens

export default function MasonryFeed({ filters }: { filters: FilterState }) {
  const [items, setItems] = useState<Property[]>([]);
  const [cycle, setCycle] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const pendingFavoriteId = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { favorites, toggleFavorite } = useFavorites();
  const { items: createdItems } = useCreatedProperties();
  const { session, signIn } = useSession();

  const loadNextPage = useCallback(() => {
    setLoading((wasLoading) => {
      if (wasLoading || done) return wasLoading;
      // Simula a latência de rede de uma chamada paginada por cursor (ver documento
      // de arquitetura — "Performance em escala").
      setTimeout(() => {
        setItems((prev) => [...prev, ...buildFeedPage(cycle)]);
        setCycle((c) => c + 1);
        setLoading(false);
      }, 500);
      return true;
    });
  }, [cycle, done]);

  useEffect(() => {
    if (cycle >= MAX_CYCLES) setDone(true);
  }, [cycle]);

  useEffect(() => {
    loadNextPage(); // primeira leva, sem esperar o scroll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && loadNextPage()),
      { rootMargin: '600px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadNextPage, done]);

  // Filtros restritivos podem deixar poucos itens visíveis dentro do que já
  // carregou — busca mais páginas automaticamente em vez de mostrar "nenhum
  // resultado" cedo demais.
  useEffect(() => {
    const visibleCount = [...createdItems, ...items].filter((p) => matchesFilters(p, filters)).length;
    if (visibleCount < 6 && !loading && !done) loadNextPage();
  }, [items, createdItems, filters, loading, done, loadNextPage]);

  const handleFavoriteClick = (id: string) => {
    if (!session.loggedIn) {
      pendingFavoriteId.current = id;
      setModalOpen(true);
      return;
    }
    toggleFavorite(id);
  };

  const handleSignIn = () => {
    signIn();
    setModalOpen(false);
    if (pendingFavoriteId.current) {
      toggleFavorite(pendingFavoriteId.current);
      pendingFavoriteId.current = null;
    }
  };

  const handleDwell = (id: string, ms: number) => {
    // Protótipo local — na versão real cada evento vai para a fila de eventos e a
    // tabela `interaction`, já vinculada a session_id / user_id (ver arquitetura).
    try {
      const key = 'mn_interactions';
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      stored[id] = { ...(stored[id] || {}), viewMs: (stored[id]?.viewMs || 0) + ms };
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // ignora falha de storage
    }
  };

  const filteredItems = [...createdItems, ...items].filter((p) => matchesFilters(p, filters));

  return (
    <>
      <div className="px-4 pb-1 pt-5 text-[15px] font-bold md:px-8 md:pt-6">Imóveis para você</div>

      <div className="columns-2 gap-2.5 px-2.5 pb-16 pt-2.5 sm:columns-3 sm:gap-3 sm:px-5 md:columns-4 md:gap-4 md:px-7 xl:columns-5 xl:gap-4.5 2xl:columns-6">
        {filteredItems.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            isFavorite={!!favorites[property.id]}
            loggedIn={session.loggedIn}
            onFavoriteClick={handleFavoriteClick}
            onDwell={handleDwell}
          />
        ))}
      </div>

      {filteredItems.length === 0 && !loading && (
        <div className="px-4 pb-16 text-center text-sm text-[var(--text-muted)]">
          Nenhum imóvel encontrado com esses filtros — tenta ajustar algum deles.
        </div>
      )}

      <div ref={sentinelRef} className="h-px" />
      <div className="px-4 pb-12 text-center text-[13px] text-[var(--text-faint)]">
        {loading && !done && 'Carregando mais imóveis…'}
        {done && 'Você viu todos os imóveis desta busca.'}
      </div>

      <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} onSignIn={handleSignIn} />
    </>
  );
}

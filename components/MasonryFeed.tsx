'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFeedPage } from '@/lib/actions';
import type { PropertyDetail } from '@/lib/property-details';
import type { FilterState } from '@/lib/filters';
import { useFavorites } from '@/lib/use-favorites';
import { useSession } from '@/lib/use-session';
import PropertyCard from './PropertyCard';
import LoginModal from './LoginModal';

export default function MasonryFeed({ filters }: { filters: FilterState }) {
  const [items, setItems] = useState<PropertyDetail[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const pendingFavoriteId = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { favorites, toggleFavorite } = useFavorites();
  const { session, signIn } = useSession();

  const loadPage = useCallback(
    async (pageToLoad: number, reset: boolean) => {
      setLoading(true);
      const { items: newItems, hasMore } = await getFeedPage(pageToLoad, filters);
      setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
      setDone(!hasMore);
      setLoading(false);
    },
    [filters]
  );

  // A filtragem agora acontece no banco de dados, não mais sobre o que já
  // carregou no navegador — então quando os filtros mudam, a busca
  // recomeça do zero em vez de só re-filtrar a lista local.
  useEffect(() => {
    setPage(0);
    loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loading && !done) {
            const next = page + 1;
            setPage(next);
            loadPage(next, false);
          }
        }),
      { rootMargin: '600px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, done, loading, loadPage]);

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
    // Ainda local por enquanto (localStorage) — o motor de recomendação de
    // verdade (ver documento de arquitetura) é a próxima peça a entrar no
    // banco, junto dos favoritos.
    try {
      const key = 'mn_interactions';
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      stored[id] = { ...(stored[id] || {}), viewMs: (stored[id]?.viewMs || 0) + ms };
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // ignora falha de storage
    }
  };

  return (
    <>
      <div className="px-4 pb-1 pt-5 text-[15px] font-bold md:px-8 md:pt-6">Imóveis para você</div>

      <div className="columns-2 gap-2.5 px-2.5 pb-16 pt-2.5 sm:columns-3 sm:gap-3 sm:px-5 md:columns-4 md:gap-4 md:px-7 xl:columns-5 xl:gap-4.5 2xl:columns-6">
        {items.map((property) => (
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

      {items.length === 0 && !loading && (
        <div className="px-4 pb-16 text-center text-sm text-[var(--text-muted)]">
          Nenhum imóvel encontrado com esses filtros — tenta ajustar algum deles.
        </div>
      )}

      <div ref={sentinelRef} className="h-px" />
      <div className="px-4 pb-12 text-center text-[13px] text-[var(--text-faint)]">
        {loading && 'Carregando…'}
        {done && items.length > 0 && 'Você viu todos os imóveis desta busca.'}
      </div>

      <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} onSignIn={handleSignIn} />
    </>
  );
}

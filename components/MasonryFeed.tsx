'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFeedPage, type FeedItem } from '@/lib/actions';
import type { FilterState } from '@/lib/filters';
import { useFavorites } from '@/lib/use-favorites';
import { useSession } from '@/lib/use-session';
import PropertyCard from './PropertyCard';
import DevelopmentCard from './DevelopmentCard';
import LoginModal from './LoginModal';

export default function MasonryFeed({ filters }: { filters: FilterState }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const pendingFavoriteId = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { favorites, toggleFavorite } = useFavorites();
  const { session, signIn } = useSession();

  // Evita que uma resposta atrasada (de um filtro anterior) sobrescreva a atual
  const requestId = useRef(0);
  const loadPage = useCallback(
    async (pageToLoad: number, reset: boolean) => {
      const myId = ++requestId.current;
      setLoading(true);
      try {
        const { items: newItems, hasMore } = await getFeedPage(pageToLoad, filters);
        if (myId !== requestId.current) return;
        setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
        setDone(!hasMore);
      } catch {
        if (myId === requestId.current) setDone(true);
      } finally {
        if (myId === requestId.current) setLoading(false);
      }
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
      <div className="px-4 pb-1 pt-5 text-[15px] font-bold md:px-8 md:pt-6">
        {filters.modo === 'lancamentos' ? 'Lançamentos e empreendimentos' : 'Imóveis para você'}
        {filters.q ? <span className="font-normal text-[var(--text-muted)]"> · busca por “{filters.q}”</span> : null}
      </div>

      <div className="columns-2 gap-2.5 px-2.5 pb-16 pt-2.5 sm:columns-3 sm:gap-3 sm:px-5 md:columns-4 md:gap-4 md:px-7 xl:columns-5 xl:gap-4.5 2xl:columns-6">
        {items.map((item) =>
          item.kind === 'empreendimento' ? (
            <DevelopmentCard key={`d-${item.development.id}`} development={item.development} />
          ) : (
            <PropertyCard
              key={`p-${item.property.id}`}
              property={item.property}
              isFavorite={!!favorites[item.property.id]}
              loggedIn={session.loggedIn}
              onFavoriteClick={handleFavoriteClick}
              onDwell={handleDwell}
            />
          )
        )}
      </div>

      {items.length === 0 && !loading && (
        <div className="px-4 pb-16 text-center text-sm text-[var(--text-muted)]">
          Nenhum resultado com esses filtros — tente ajustar algum deles ou limpar a busca.
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

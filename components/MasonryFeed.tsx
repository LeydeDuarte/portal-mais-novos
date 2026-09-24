'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFeedPage, getAnunciosOcultos, type FeedItem, type AnuncioOculto } from '@/lib/actions';
import { countActiveFilters, type FilterState } from '@/lib/filters';
import OcultoCard from './OcultoCard';
import { useFavorites } from '@/lib/use-favorites';
import { useSession } from '@/lib/use-session';
import PropertyCard from './PropertyCard';
import DevelopmentCard from './DevelopmentCard';
import LoginModal from './LoginModal';
import type { Cliente } from '@/lib/cliente-auth';

export default function MasonryFeed({ filters }: { filters: FilterState }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [ocultos, setOcultos] = useState<AnuncioOculto[]>([]);
  const filtrando = countActiveFilters(filters) > 0;
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
  // Fim da busca com filtro: mostra os anúncios RESERVADOS (privados) que
  // atendem a mesma busca — só características, sem fotos nem endereço.
  useEffect(() => {
    setOcultos([]);
    if (!done || !filtrando) return;
    let vivo = true;
    getAnunciosOcultos(filters)
      .then((o) => vivo && setOcultos(o))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [done, filtrando, filters]);

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

  const handleSignIn = (cliente?: Cliente | null) => {
    signIn(cliente);
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
        {filters.locais.length ? (
          <span className="font-normal text-[var(--text-muted)]"> · em {filters.locais.map((l) => l.nome).join(', ')}</span>
        ) : null}
        {filters.termos.length ? (
          <span className="font-normal text-[var(--text-muted)]"> · busca por {filters.termos.map((t) => `“${t}”`).join(' ou ')}</span>
        ) : null}
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

      {done && ocultos.length > 0 && (
        <section className="mx-auto mb-16 w-full max-w-6xl px-4 md:px-8" aria-label="Anúncios reservados">
          <h2 className="text-lg font-bold">Anúncios reservados que podem atender sua busca</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Imóveis do nosso portfólio que o proprietário preferiu não publicar abertamente. Mostramos só as características — peça para ver o anúncio
            completo e verificamos a disponibilidade para você.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {ocultos.map((a) => (
              <OcultoCard key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} onSignIn={handleSignIn} />
    </>
  );
}

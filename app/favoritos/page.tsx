'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PropertyCard from '@/components/PropertyCard';
import LoginModal from '@/components/LoginModal';
import { getMyFavoriteProperties } from '@/lib/actions-client-data';
import { useFavorites } from '@/lib/use-favorites';
import { useSession } from '@/lib/use-session';
import type { PropertyDetail } from '@/lib/property-details';

export default function FavoritosPage() {
  const { session, signIn } = useSession();
  const { favorites, toggleFavorite } = useFavorites();
  const [items, setItems] = useState<PropertyDetail[] | null>(null);
  const [login, setLogin] = useState(false);

  useEffect(() => {
    getMyFavoriteProperties().then(setItems).catch(() => setItems([]));
  }, [session.loggedIn]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="w-full flex-1 px-4 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Meus favoritos</h1>
        {!session.loggedIn && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            <button type="button" onClick={() => setLogin(true)} className="font-semibold text-accent underline">
              Entre com o Google
            </button>{' '}
            para guardar seus favoritos na sua conta e ver em qualquer aparelho.
          </p>
        )}
        {items === null ? (
          <p className="mt-6 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--text-muted)]">
            Nenhum favorito ainda. Toque no coração dos imóveis que gostar.{' '}
            <Link href="/" className="font-semibold text-accent">
              Ver imóveis →
            </Link>
          </p>
        ) : (
          <div className="mt-5 columns-2 gap-2.5 sm:columns-3 md:columns-4 xl:columns-5">
            {items.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                isFavorite={favorites[p.id] ?? true}
                loggedIn={session.loggedIn}
                onFavoriteClick={(id) => toggleFavorite(id)}
                onDwell={() => {}}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
      <LoginModal
        open={login}
        onClose={() => setLogin(false)}
        titulo="Entre para salvar seus favoritos"
        onSignIn={(c) => {
          signIn(c);
          setLogin(false);
        }}
      />
    </div>
  );
}

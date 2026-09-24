'use client';

import { useState } from 'react';
import { useFavorites } from '@/lib/use-favorites';
import { useSession } from '@/lib/use-session';
import LoginModal from './LoginModal';
import type { Cliente } from '@/lib/cliente-auth';

export default function DetailFavoriteButton({ propertyId }: { propertyId: string }) {
  const { favorites, toggleFavorite } = useFavorites();
  const { session, signIn } = useSession();
  const [modalOpen, setModalOpen] = useState(false);
  const isFavorite = !!favorites[propertyId];

  const handleClick = () => {
    if (!session.loggedIn) {
      setModalOpen(true);
      return;
    }
    toggleFavorite(propertyId);
  };

  const handleSignIn = (cliente?: Cliente | null) => {
    signIn(cliente);
    setModalOpen(false);
    toggleFavorite(propertyId);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
          isFavorite ? 'border-accent bg-accent text-white' : 'border-[var(--border)] hover:bg-[var(--pill-bg)]'
        }`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill={isFavorite ? '#14161A' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.6 6.9 4.3 5.4c2.2-1.2 4.9-.5 6.2 1.6l1.5 2.4 1.5-2.4c1.3-2.1 4-2.8 6.2-1.6 2.7 1.5 3.3 4.7 1.6 7.4C18.7 16.65 12 21 12 21z" />
        </svg>
        {isFavorite ? 'Salvo nos favoritos' : 'Favoritar imóvel'}
      </button>

      <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} onSignIn={handleSignIn} />
    </>
  );
}

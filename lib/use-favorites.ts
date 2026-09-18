'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mn_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setFavorites(JSON.parse(stored));
    } catch {
      // localStorage indisponível — segue com favoritos vazios nesta sessão
    }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignora falha de storage
      }
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}

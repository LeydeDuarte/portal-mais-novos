'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMyFavorites, importFavorites, setFavorite } from './actions-client-data';

// Favoritos agora ficam no banco (tabela `favorites`), ligados a um
// identificador anônimo do visitante — ver lib/actions-client-data.ts.
// A "forma" do hook continua a mesma (favorites, toggleFavorite), então as
// telas que já usavam não precisaram mudar.
const LEGACY_STORAGE_KEY = 'mn_favorites';

function readLegacyFavorites(): string[] {
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Record<string, boolean>;
    return Object.entries(parsed).filter(([, v]) => v).map(([id]) => id);
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Migração única do que estava salvo no navegador
        const legacy = readLegacyFavorites();
        if (legacy.length) {
          await importFavorites(legacy);
          try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          } catch {
            // ignora
          }
        }
        const ids = await getMyFavorites();
        if (!cancelled) setFavorites(Object.fromEntries(ids.map((id) => [id, true])));
      } catch {
        // banco indisponível — segue com favoritos vazios nesta visita
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  const toggleFavorite = useCallback((id: string) => {
    const nextValue = !favoritesRef.current[id];
    // Atualiza a tela na hora e grava no banco em segundo plano; se falhar,
    // desfaz a marcação.
    setFavorites((prev) => ({ ...prev, [id]: nextValue }));
    setFavorite(id, nextValue).catch(() => {
      setFavorites((cur) => ({ ...cur, [id]: !nextValue }));
    });
  }, []);

  return { favorites, toggleFavorite };
}

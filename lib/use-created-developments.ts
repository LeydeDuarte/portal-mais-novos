'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Development } from './property-details';

// Empreendimentos/condomínios cadastrados pelo painel — mesmo padrão do
// lib/use-created-properties.ts, protótipo local via localStorage.
const STORAGE_KEY = 'mn_created_developments';

function readAll(): Development[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function writeAll(items: Development[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignora falha de storage
  }
}

export function useCreatedDevelopments() {
  const [items, setItems] = useState<Development[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(readAll());
    setLoaded(true);
  }, []);

  const add = useCallback((development: Development) => {
    setItems((prev) => {
      const next = [development, ...prev];
      writeAll(next);
      return next;
    });
  }, []);

  return { items, loaded, add };
}

export function getCreatedDevelopmentById(id: string): Development | null {
  if (typeof window === 'undefined') return null;
  return readAll().find((d) => d.id === id) ?? null;
}

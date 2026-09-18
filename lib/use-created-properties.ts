'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PropertyDetail } from './property-details';

// Imóveis cadastrados pelo painel do corretor/admin. Protótipo local via
// localStorage — na versão real isso é um INSERT na tabela `property` (ver
// documento de arquitetura), e some no caso de rascunho ainda não aprovado.
const STORAGE_KEY = 'mn_created_properties';

function readAll(): PropertyDetail[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function writeAll(items: PropertyDetail[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignora falha de storage
  }
}

export function useCreatedProperties() {
  const [items, setItems] = useState<PropertyDetail[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(readAll());
    setLoaded(true);
  }, []);

  const add = useCallback((property: PropertyDetail) => {
    setItems((prev) => {
      const next = [property, ...prev];
      writeAll(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeAll(next);
      return next;
    });
  }, []);

  return { items, loaded, add, remove };
}

export function getCreatedPropertyById(id: string): PropertyDetail | null {
  if (typeof window === 'undefined') return null;
  return readAll().find((p) => p.id === id) ?? null;
}

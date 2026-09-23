'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MarketReference } from './market-mock';
import {
  addMarketLead,
  getMarketLeads,
  getTakenReferenceIds,
  updateMarketLeadStatus,
  type MarketLead,
  type MarketLeadStatus
} from './actions-client-data';

export type { MarketLead };

// Leads de captação agora ficam no banco (tabela `market_leads`), com o
// corretor responsável vindo da sessão da equipe. Admin vê os leads de todos;
// corretor vê só os seus. `takenIds` marca as referências que já viraram lead
// de qualquer corretor, pra ninguém captar o mesmo imóvel em dobro.
const LEGACY_STORAGE_KEY = 'mn_market_leads';

function readLegacyLeads(): MarketReference[] {
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useMarketLeads(enabled = true) {
  const [items, setItems] = useState<MarketLead[]>([]);
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [leads, taken] = await Promise.all([getMarketLeads(), getTakenReferenceIds()]);
    setItems(leads);
    setTakenIds(new Set(taken));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        // Migração única dos leads que estavam salvos só neste navegador
        const legacy = readLegacyLeads();
        if (legacy.length) {
          for (const ref of legacy) await addMarketLead(ref);
          try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          } catch {
            // ignora
          }
        }
        if (!cancelled) await reload();
      } catch {
        if (!cancelled) setError('Não foi possível carregar os leads agora. Tente recarregar a página.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, reload]);

  const addLead = useCallback(
    async (reference: MarketReference) => {
      setError(null);
      try {
        const lead = await addMarketLead(reference);
        if (!lead) setError('Esse imóvel já foi marcado como lead por outro corretor.');
        await reload();
      } catch {
        setError('Não foi possível salvar o lead. Tente novamente.');
      }
    },
    [reload]
  );

  const updateStatus = useCallback(async (leadId: string, status: MarketLeadStatus) => {
    setError(null);
    setItems((prev) => prev.map((l) => (l.leadId === leadId ? { ...l, status } : l)));
    try {
      await updateMarketLeadStatus(leadId, status);
    } catch {
      setError('Não foi possível atualizar o status. Tente novamente.');
    }
  }, []);

  return { items, takenIds, loaded, error, addLead, updateStatus };
}

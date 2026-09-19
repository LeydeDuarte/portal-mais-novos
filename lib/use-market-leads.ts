'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MarketReference } from './market-mock';

// Leads de captação criados a partir do painel de monitoramento — protótipo
// local via localStorage, mesmo padrão dos outros hooks `use-created-*`. Em
// produção isso vira a tabela `lead` já descrita no documento de arquitetura,
// com corretor responsável e status do funil.
export type MarketLead = MarketReference & {
  leadId: string;
  corretorEmail: string;
  criadoEm: string;
  status: 'novo' | 'contatado' | 'descartado';
};

const STORAGE_KEY = 'mn_market_leads';

function readAll(): MarketLead[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function writeAll(items: MarketLead[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignora falha de storage
  }
}

export function useMarketLeads() {
  const [items, setItems] = useState<MarketLead[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(readAll());
    setLoaded(true);
  }, []);

  const addLead = useCallback((reference: MarketReference, corretorEmail: string) => {
    setItems((prev) => {
      if (prev.some((l) => l.id === reference.id)) return prev; // já é lead, evita duplicar
      const lead: MarketLead = { ...reference, leadId: `lead-${Date.now()}`, corretorEmail, criadoEm: new Date().toISOString(), status: 'novo' };
      const next = [lead, ...prev];
      writeAll(next);
      return next;
    });
  }, []);

  const updateStatus = useCallback((leadId: string, status: MarketLead['status']) => {
    setItems((prev) => {
      const next = prev.map((l) => (l.leadId === leadId ? { ...l, status } : l));
      writeAll(next);
      return next;
    });
  }, []);

  return { items, loaded, addLead, updateStatus };
}

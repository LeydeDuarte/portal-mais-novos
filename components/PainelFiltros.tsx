'use client';

import { useEffect, useState } from 'react';
import FiltrosLaterais from './FiltrosLaterais';
import { countActiveFilters, type FilterState } from '@/lib/filters';

// Lateral esquerda recolhível com os filtros. Recolhida, fica só uma aba "Filtros"
// na borda. A escolha (aberta/recolhida) fica gravada no navegador.
// No celular vira uma gaveta que abre pela aba.
export default function PainelFiltros({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  const [aberto, setAberto] = useState(true);
  const [gaveta, setGaveta] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem('mn_filtros') === 'fechado') setAberto(false);
    } catch {
      /* sem armazenamento */
    }
  }, []);
  const alternar = (v: boolean) => {
    setAberto(v);
    try {
      localStorage.setItem('mn_filtros', v ? 'aberto' : 'fechado');
    } catch {
      /* ignora */
    }
  };
  // todos os filtros ativos, inclusive a busca do topo (bairro, condomínio, palavras) e as fases
  const n = countActiveFilters(filters);

  const Aba = ({ onClick, className = '' }: { onClick: () => void; className?: string }) => (
    <button
      type="button"
      onClick={onClick}
      className={`z-30 flex items-center gap-1.5 rounded-r-xl bg-[#0038FF] px-2 py-3 text-[12px] font-bold text-white shadow-lg [writing-mode:vertical-rl] ${className}`}
      aria-label="Abrir filtros"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className="rotate-90">
        <path d="M4 6h16M7 12h10M10 18h4" />
      </svg>
      Filtros
      {n > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#FF385C] px-1 text-[11px] font-bold [writing-mode:horizontal-tb]" aria-label={`${n} filtros ativos`}>
          {n}
        </span>
      )}
    </button>
  );

  return (
    <>
      {/* computador */}
      <div className="relative hidden shrink-0 md:block">
        {aberto ? (
          <aside className="sticky top-0 h-screen w-[260px] overflow-y-auto border-r border-[var(--border)] px-5 pb-10 pt-5 [scrollbar-width:thin]">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[15px] font-bold">Filtros{n ? ` (${n})` : ''}</span>
              <button type="button" onClick={() => alternar(false)} className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-[var(--text-muted)] hover:bg-[var(--pill-bg)]">
                Recolher ‹
              </button>
            </div>
            <FiltrosLaterais filters={filters} onChange={onChange} />
          </aside>
        ) : (
          <div className="sticky top-24">
            <Aba onClick={() => alternar(true)} />
          </div>
        )}
      </div>

      {/* celular: aba presa na borda esquerda */}
      <Aba onClick={() => setGaveta(true)} className="fixed left-0 top-[136px] md:hidden" />
      {gaveta && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Fechar" onClick={() => setGaveta(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[340px] overflow-y-auto bg-[var(--bg)] p-5">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-lg font-bold">Filtros{n ? ` (${n})` : ''}</span>
              <button type="button" onClick={() => setGaveta(false)} className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white">
                Ver imóveis
              </button>
            </div>
            <FiltrosLaterais filters={filters} onChange={onChange} />
          </div>
        </div>
      )}
    </>
  );
}

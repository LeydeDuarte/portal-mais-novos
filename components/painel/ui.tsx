'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Peças visuais do painel (mesmo estilo em todas as telas): título, busca grande,
// seções de filtro com "chips", filtros ativos, menu "⋯" e barra de seleção.

export function TituloPainel({ titulo, contagem, children }: { titulo: string; contagem?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-[30px] font-semibold leading-none tracking-tight md:text-[36px]">{titulo}</h1>
        {contagem != null && <div className="mt-2 text-[13px] text-[var(--text-muted)]">{contagem}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function BuscaGrande({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full">
      <svg className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-full border border-transparent bg-[var(--pill-bg)] pl-12 pr-12 text-[15px] outline-none transition placeholder:text-[var(--text-muted)] hover:bg-[var(--pill-bg-hover)] focus:border-ink focus:bg-[var(--bg)]"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-ink text-white">
          ×
        </button>
      )}
    </div>
  );
}

export function SecaoFiltro({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wide">{titulo}</div>
      {children}
    </div>
  );
}

/** Valores marcados num filtro de várias opções (guardados como "a,b,c") */
export const marcados = (csv: string | undefined | null): string[] => (csv ? csv.split(',').filter(Boolean) : []);

/** Chips de filtro. Com `multi`, dá para marcar várias opções (o valor vira "a,b,c"). */
export function Chips<T extends string>({
  opcoes,
  valor,
  onChange,
  multi = false
}: {
  opcoes: { v: T; l: string; n?: number }[];
  valor: T | '' | string;
  onChange: (v: T | '') => void;
  multi?: boolean;
}) {
  const lista = multi ? marcados(valor) : [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const on = multi ? lista.includes(o.v) : valor === o.v;
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(
                multi ? ((on ? lista.filter((x) => x !== o.v) : [...lista, o.v]).join(',') as T | '') : on ? '' : o.v
              )
            }
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
              on ? 'border-ink bg-ink text-white' : 'border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--pill-bg)]'
            }`}
          >
            {o.l}
            {o.n != null && <span className={`ml-1 ${on ? 'text-white/70' : 'text-[var(--text-faint)]'}`}>{o.n}</span>}
          </button>
        );
      })}
    </div>
  );
}

export const campoPainel =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none transition focus:border-ink';

/** Filtros ativos em "pílulas" pretas com × para tirar cada um */
export function FiltrosAtivos({ itens, onLimpar }: { itens: { rotulo: string; tirar: () => void }[]; onLimpar: () => void }) {
  if (!itens.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {itens.map((i) => (
        <span key={i.rotulo} className="flex items-center gap-1.5 rounded-full bg-ink py-1 pl-3 pr-1 text-[12.5px] font-medium text-white">
          {i.rotulo}
          <button type="button" onClick={i.tirar} aria-label={`Tirar ${i.rotulo}`} className="grid h-6 w-6 place-items-center rounded-full bg-white/15 hover:bg-white/25">
            ×
          </button>
        </span>
      ))}
      <button type="button" onClick={onLimpar} className="text-[12.5px] font-medium text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)]">
        Limpar filtros
      </button>
    </div>
  );
}

/** Botão "⋯" com menu suspenso. O menu é desenhado por cima da página inteira
 * (fora do card), para não ficar cortado dentro de cards com bordas arredondadas. */
export function MenuAcoes({ itens }: { itens: ({ rotulo: string; onClick?: () => void; href?: string; perigo?: boolean; novaAba?: boolean } | 'sep')[] }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const LARG = 240;
  useEffect(() => {
    if (!pos) return;
    const fora = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setPos(null);
    };
    const fechar = () => setPos(null);
    document.addEventListener('mousedown', fora);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', fora);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [pos]);
  const abrir = () => {
    if (pos) return setPos(null);
    const r = btn.current!.getBoundingClientRect();
    const altura = itens.length * 42 + 16;
    const top = r.bottom + 6 + altura > window.innerHeight ? Math.max(8, r.top - 6 - altura) : r.bottom + 6;
    setPos({ top, left: Math.max(8, Math.min(r.right - LARG, window.innerWidth - LARG - 8)) });
  };
  const fechar = () => setPos(null);
  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={abrir}
        aria-label="Mais ações"
        aria-expanded={!!pos}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--pill-bg)] text-[15px] font-bold transition hover:bg-[var(--pill-bg-hover)]"
      >
        ⋯
      </button>
      {pos &&
        createPortal(
          <div
            ref={menu}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: LARG }}
            className="z-[200] rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
          >
            {itens.map((i, k) =>
              i === 'sep' ? (
                <div key={k} className="my-1 h-px bg-[var(--border)]" />
              ) : i.href ? (
                <a
                  key={k}
                  href={i.href}
                  {...(i.novaAba ? { target: '_blank', rel: 'noopener' } : {})}
                  onClick={fechar}
                  className="flex w-full items-center rounded-[10px] px-3 py-2.5 text-[13px] font-medium hover:bg-[var(--pill-bg)]"
                >
                  {i.rotulo}
                </a>
              ) : (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    fechar();
                    i.onClick?.();
                  }}
                  className={`flex w-full items-center rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium ${i.perigo ? 'text-red-600 hover:bg-red-50' : 'hover:bg-[var(--pill-bg)]'}`}
                >
                  {i.rotulo}
                </button>
              )
            )}
          </div>,
          document.body
        )}
    </>
  );
}

/** Barra flutuante embaixo quando há itens selecionados */
export function BarraSelecao({ n, onLimpar, children }: { n: number; onLimpar: () => void; children: ReactNode }) {
  if (!n) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-2 py-2 text-white shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
      <span className="pl-3 pr-1 text-[13px] font-medium">{n} selecionado(s)</span>
      <span className="h-6 w-px bg-white/20" />
      {children}
      <button type="button" onClick={onLimpar} aria-label="Limpar seleção" className="mr-1 grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20">
        ×
      </button>
    </div>
  );
}

export const botaoBarra = 'h-8 rounded-full bg-white px-4 text-[13px] font-semibold text-ink hover:bg-[#EFEFEF]';
export const botaoBarraSec = 'h-8 rounded-full bg-white/15 px-4 text-[13px] font-medium hover:bg-white/25';

export function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--border)] p-12 text-center">
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[var(--pill-bg)] text-2xl text-[var(--text-muted)]">⌕</div>
      <div className="font-semibold">{titulo}</div>
      <div className="mt-1 text-[14px] text-[var(--text-muted)]">{texto}</div>
    </div>
  );
}

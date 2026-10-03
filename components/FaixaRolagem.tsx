'use client';

// Faixa que rola para o lado (tópicos, filtros): no computador, setas nas pontas com
// fundo esmaecido, e a roda do mouse também anda para o lado. No celular, só o dedo.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export default function FaixaRolagem({ children, className = '', rotulo }: { children: ReactNode; className?: string; rotulo?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [setas, setSetas] = useState({ esq: false, dir: false });
  const medir = useCallback(() => {
    const el = ref.current;
    if (el) setSetas({ esq: el.scrollLeft > 4, dir: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    el.addEventListener('scroll', medir, { passive: true });
    const roda = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', medir);
      el.removeEventListener('wheel', roda);
    };
  }, [medir]);
  const rolar = (lado: 1 | -1) => ref.current?.scrollBy({ left: lado * Math.max(240, (ref.current?.clientWidth ?? 600) * 0.7), behavior: 'smooth' });
  const seta = 'flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-lg shadow-sm hover:border-accent hover:text-accent';
  return (
    <div className="relative">
      {setas.esq && (
        <button
          type="button"
          onClick={() => rolar(-1)}
          aria-label="Voltar"
          className="absolute inset-y-0 left-0 z-10 hidden w-16 items-center justify-start bg-gradient-to-r from-[var(--bg)] via-[var(--bg)]/90 to-transparent md:flex"
        >
          <span className={seta}>‹</span>
        </button>
      )}
      {setas.dir && (
        <button
          type="button"
          onClick={() => rolar(1)}
          aria-label="Ver mais"
          className="absolute inset-y-0 right-0 z-10 hidden w-16 items-center justify-end bg-gradient-to-l from-[var(--bg)] via-[var(--bg)]/90 to-transparent md:flex"
        >
          <span className={seta}>›</span>
        </button>
      )}
      <div ref={ref} aria-label={rotulo} className={`overflow-x-auto [scrollbar-width:none] ${className}`}>
        {children}
      </div>
    </div>
  );
}

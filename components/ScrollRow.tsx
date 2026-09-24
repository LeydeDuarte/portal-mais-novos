'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string; // classes do trilho (padding, gap...)
  fadeFrom?: string; // cor do esmaecido (padrão: fundo da página)
};

// Faixa com rolagem para o lado: no celular a pessoa arrasta com o dedo; no
// computador aparecem setinhas nas pontas, com um esmaecido suave, sem a barra
// de rolagem (que fica feia). A seta só aparece quando há mais conteúdo daquele lado.
export default function ScrollRow({ children, className = '', fadeFrom = 'var(--bg)' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setLeft(el.scrollLeft > 4);
    setRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update, children]);

  const mover = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' });
  };

  const seta = (dir: 1 | -1) => (
    <div
      className={`pointer-events-none absolute inset-y-0 z-10 hidden w-20 items-center md:flex ${dir === 1 ? 'right-0 justify-end pr-2' : 'left-0 justify-start pl-2'}`}
      style={{ background: `linear-gradient(to ${dir === 1 ? 'left' : 'right'}, ${fadeFrom} 35%, transparent)` }}
    >
      <button
        type="button"
        onClick={() => mover(dir)}
        aria-label={dir === 1 ? 'Ver mais para a direita' : 'Voltar para a esquerda'}
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-lg shadow-md transition-transform hover:scale-105"
      >
        {dir === 1 ? '›' : '‹'}
      </button>
    </div>
  );

  return (
    <div className="relative">
      <div ref={ref} className={`flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
        {children}
      </div>
      {left && seta(-1)}
      {right && seta(1)}
    </div>
  );
}

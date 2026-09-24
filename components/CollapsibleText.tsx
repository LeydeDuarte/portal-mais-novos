'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// Texto longo aparece cortado com um esmaecido embaixo e o botão "Ler descrição
// completa". O texto inteiro continua na página (bom para o Google/SEO), só
// fica visualmente recolhido até a pessoa pedir.
export default function CollapsibleText({ children, maxHeight = 260 }: { children: ReactNode; maxHeight?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [longo, setLongo] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setLongo(el.scrollHeight > maxHeight + 40);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxHeight]);

  const recolhido = longo && !aberto;
  return (
    <div>
      <div className="relative">
        <div ref={ref} style={recolhido ? { maxHeight, overflow: 'hidden' } : undefined}>
          {children}
        </div>
        {recolhido && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--bg)]" />}
      </div>
      {longo && (
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--pill-bg)]"
        >
          {aberto ? 'Mostrar menos ↑' : 'Ler descrição completa ↓'}
        </button>
      )}
    </div>
  );
}

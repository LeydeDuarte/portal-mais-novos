'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// "Voltar ao topo" discreto: setinha esmaecida com o texto, sem fundo, no canto
// inferior direito. No site aparece depois de ~2 telas de rolagem e quando a pessoa
// começa a SUBIR (sinal de que quer voltar); no painel, depois de 1 tela, sempre.
// Fica fora das telas de mapa (que não rolam) e dos documentos em impressão.
export default function VoltarAoTopo() {
  const pathname = usePathname() ?? '';
  const painel = pathname.startsWith('/dashboard');
  const fora = /\/mapa(\/|$)/.test(pathname);
  const [ver, setVer] = useState(false);
  const ultimo = useRef(0);

  useEffect(() => {
    if (fora) return;
    const medir = () => {
      const y = window.scrollY;
      const tela = window.innerHeight;
      const subindo = y < ultimo.current - 4;
      const descendo = y > ultimo.current + 4;
      if (painel) setVer(y > tela);
      else if (y < tela * 2) setVer(false);
      else if (subindo) setVer(true);
      else if (descendo) setVer(false);
      ultimo.current = y;
    };
    medir();
    window.addEventListener('scroll', medir, { passive: true });
    return () => window.removeEventListener('scroll', medir);
  }, [painel, fora]);

  if (fora) return null;
  const subir = () => {
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: suave ? 'smooth' : 'auto' });
  };

  return (
    <button
      type="button"
      onClick={subir}
      aria-label="Voltar ao topo"
      tabIndex={ver ? 0 : -1}
      className={`fixed bottom-4 right-3 z-30 flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-all duration-200 hover:text-accent focus-visible:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent print:hidden md:bottom-6 md:right-6 md:flex-row md:gap-1.5 md:text-[12.5px] ${
        ver ? 'pointer-events-auto opacity-70 hover:opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="md:h-4 md:w-4">
        <path d="m6 15 6-6 6 6" />
      </svg>
      Voltar ao topo
    </button>
  );
}

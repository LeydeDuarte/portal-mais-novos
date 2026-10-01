'use client';

import { useEffect, useRef, useState } from 'react';

// Compartilhar (só o ícone): no celular abre o menu do próprio aparelho; no computador,
// um menu com WhatsApp e copiar link. Conta no painel de Resultados (data-rastro).
// menuAcima: o menu abre sempre para cima (botão na barra fixa do rodapé; abrir para
// baixo jogava o menu para fora da tela no computador)
export default function BotaoCompartilhar({
  url,
  titulo,
  refId,
  tamanho = 40,
  menuAcima = false
}: {
  url: string;
  titulo: string;
  refId?: string;
  tamanho?: number;
  menuAcima?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const caixa = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);
  // celular/tablet com menu de compartilhar do aparelho (decidido só no navegador)
  const [toque, setToque] = useState(false);
  useEffect(() => setToque(!!navigator.share && window.matchMedia('(pointer: coarse)').matches), []);

  return (
    <div ref={caixa} className="relative shrink-0">
      <button
        type="button"
        aria-label="Compartilhar"
        title="Compartilhar"
        {...(toque ? { 'data-rastro': 'compartilhar', 'data-rastro-ref': refId } : {})}
        onClick={() => (toque ? navigator.share({ title: titulo, url }).catch(() => {}) : setAberto((a) => !a))}
        style={{ width: tamanho, height: tamanho }}
        className="grid place-items-center rounded-full border border-[var(--border)] bg-[var(--bg)] transition-colors hover:bg-[var(--pill-bg)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
      </button>
      {aberto && (
        <div
          className={`absolute bottom-full z-[95] mb-2 w-52 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-1.5 shadow-xl ${
            menuAcima ? 'left-0' : 'right-0 md:bottom-auto md:top-full md:mb-0 md:mt-2'
          }`}
        >
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${titulo}\n${url}`)}`}
            target="_blank"
            rel="noopener"
            data-rastro="compartilhar"
            data-rastro-ref={refId}
            onClick={() => setAberto(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[var(--pill-bg)]"
          >
            <span className="text-[#1BA84F]">●</span> WhatsApp
          </a>
          <button
            type="button"
            data-rastro="compartilhar"
            data-rastro-ref={refId}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopiado(true);
                setTimeout(() => {
                  setCopiado(false);
                  setAberto(false);
                }, 1200);
              } catch {
                window.prompt('Copie o link:', url);
              }
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-[var(--pill-bg)]"
          >
            <span className="text-accent">●</span> {copiado ? 'Link copiado!' : 'Copiar link'}
          </button>
        </div>
      )}
    </div>
  );
}

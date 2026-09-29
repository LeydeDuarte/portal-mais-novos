'use client';

import { useEffect, useState } from 'react';

// Botão para escolher o formato do feed (Masonry ou Alinhado). A escolha fica
// gravada num cookie por 2 anos: toda vez que a pessoa voltar, o feed abre no
// formato escolhido, até ela trocar de novo. Enquanto ela não experimentar, o
// botão pulsa e um balãozinho avisa que dá para trocar.
export default function FeedModoToggle({ modo, onChange, jaEscolheu }: { modo: 'masonry' | 'alinhado'; onChange: (m: 'masonry' | 'alinhado') => void; jaEscolheu: boolean }) {
  const [dica, setDica] = useState(false);
  useEffect(() => {
    if (!jaEscolheu) {
      const t = setTimeout(() => setDica(true), 1200);
      return () => clearTimeout(t);
    }
  }, [jaEscolheu]);

  const escolher = (m: 'masonry' | 'alinhado') => {
    document.cookie = `mn_feed=${m}; path=/; max-age=${60 * 60 * 24 * 730}; samesite=lax`;
    setDica(false);
    onChange(m);
  };

  const Botao = ({ m, titulo, children }: { m: 'masonry' | 'alinhado'; titulo: string; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => escolher(m)}
      aria-pressed={modo === m}
      title={titulo}
      className={`grid h-8 w-9 place-items-center rounded-full transition ${modo === m ? 'bg-ink text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="relative">
      <div className={`flex items-center gap-0.5 rounded-full bg-[var(--pill-bg)] p-1 ${!jaEscolheu ? 'feed-pulso' : ''}`} role="group" aria-label="Formato do feed">
        <Botao m="masonry" titulo="Feed Masonry (cada foto no seu formato)">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="3" y="3" width="8" height="11" rx="2" />
            <rect x="13" y="3" width="8" height="6" rx="2" />
            <rect x="3" y="16" width="8" height="5" rx="2" />
            <rect x="13" y="11" width="8" height="10" rx="2" />
          </svg>
        </Botao>
        <Botao m="alinhado" titulo="Feed Alinhado (linhas retas)">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <rect x="13" y="3" width="8" height="8" rx="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" />
            <rect x="13" y="13" width="8" height="8" rx="2" />
          </svg>
        </Botao>
      </div>
      {dica && (
        <div className="feed-balao pointer-events-none absolute right-0 top-11 z-20 w-[210px] rounded-xl bg-ink px-3 py-2 text-[12px] font-medium leading-snug text-white shadow-lg">
          Novo: escolha o formato do feed, Masonry ou Alinhado.
          <span className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 bg-ink" />
        </div>
      )}
    </div>
  );
}

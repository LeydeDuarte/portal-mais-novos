'use client';

import { useEffect, useState } from 'react';

type Props = {
  plantas: string[];
  titulo: string; // usado no alt (SEO): "Planta do Apartamento de 130 m² no Marista 262"
  compacta?: boolean; // miniatura (cards de tipologia)
};

// Planta da unidade: fundo branco, imagem inteira (nunca cortada) e tela cheia
// com zoom — planta pequena na tela do celular não dá para ler.
export default function PlantaViewer({ plantas, titulo, compacta = false }: Props) {
  const [aberta, setAberta] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (aberta == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberta(null);
      if (e.key === 'ArrowRight') setAberta((i) => (i == null ? i : (i + 1) % plantas.length));
      if (e.key === 'ArrowLeft') setAberta((i) => (i == null ? i : (i - 1 + plantas.length) % plantas.length));
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [aberta, plantas.length]);

  useEffect(() => setZoom(1), [aberta]);

  if (!plantas.length) return null;

  return (
    <>
      <div className={compacta ? '' : `grid gap-3 ${plantas.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {(compacta ? plantas.slice(0, 1) : plantas).map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAberta(i);
            }}
            className={`group relative block w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white ${compacta ? 'h-[150px]' : 'aspect-[16/10] max-h-[460px]'}`}
            aria-label={`Ampliar planta ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Planta ${plantas.length > 1 ? `${i + 1} ` : ''}— ${titulo}`}
              loading="lazy"
              className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute bottom-2 right-2 rounded-md bg-ink/75 px-2 py-1 text-[11px] font-semibold text-white">
              {compacta && plantas.length > 1 ? `${plantas.length} plantas · ampliar` : 'Ampliar ⤢'}
            </span>
          </button>
        ))}
      </div>

      {aberta != null && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Planta ampliada">
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-white">
            <span className="truncate text-sm font-semibold">
              Planta{plantas.length > 1 ? ` ${aberta + 1} de ${plantas.length}` : ''} — {titulo}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/25" aria-label="Diminuir zoom">
                −
              </button>
              <span className="w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/25" aria-label="Aumentar zoom">
                +
              </button>
              <button type="button" onClick={() => setAberta(null)} className="ml-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/25" aria-label="Fechar">
                ✕
              </button>
            </div>
          </div>
          <div className="relative flex-1 overflow-auto" onClick={(e) => e.target === e.currentTarget && setAberta(null)}>
            <div className="flex min-h-full min-w-full items-center justify-center p-3" style={{ width: `${zoom * 100}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={plantas[aberta]}
                alt={`Planta — ${titulo}`}
                onClick={() => setZoom((z) => (z >= 2 ? 1 : 2))}
                className={`rounded-lg bg-white p-2 ${zoom === 1 ? 'max-h-[calc(100vh-90px)] max-w-full cursor-zoom-in object-contain' : 'w-full cursor-zoom-out'}`}
              />
            </div>
            {plantas.length > 1 && (
              <>
                <button type="button" onClick={() => setAberta((aberta - 1 + plantas.length) % plantas.length)} className="fixed left-3 top-1/2 rounded-full bg-black/70 px-3.5 py-2 text-2xl text-white shadow-lg ring-1 ring-white/30 hover:bg-black" aria-label="Planta anterior">
                  ‹
                </button>
                <button type="button" onClick={() => setAberta((aberta + 1) % plantas.length)} className="fixed right-3 top-1/2 rounded-full bg-black/70 px-3.5 py-2 text-2xl text-white shadow-lg ring-1 ring-white/30 hover:bg-black" aria-label="Próxima planta">
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

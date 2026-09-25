'use client';

import { useState } from 'react';
import type { DepoimentoCard as Dep } from '@/lib/especiais-tipos';
import { semTravessoes } from '@/lib/text';

// Card de DEPOIMENTO no feed: borda em volta e a barrinha "Depoimento" no topo,
// para não ser confundido com anúncio.
export default function DepoimentoCard({ d }: { d: Dep }) {
  const [aberto, setAberto] = useState(false);
  const texto = semTravessoes(d.texto);
  const longo = texto.length > 260;
  return (
    <div className="mb-2.5 inline-block w-full break-inside-avoid md:mb-4">
      <figure className="overflow-hidden rounded-2xl border-2 border-accent/35 bg-[var(--bg)]">
        <div className="flex items-center gap-1.5 bg-accent px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M9.5 6C6.5 6 4 8.6 4 11.8V18h6v-6H7c0-1.8 1.2-3.2 2.5-3.2V6zm10 0c-3 0-5.5 2.6-5.5 5.8V18h6v-6h-3c0-1.8 1.2-3.2 2.5-3.2V6z" />
          </svg>
          Depoimento
        </div>
        <div className="p-4">
          {d.nota ? (
            <div className="mb-2 flex gap-0.5 text-[#F5A524]" aria-label={`${d.nota} de 5 estrelas`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < d.nota! ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.1l-5.6 3 1.1-6.3L2.9 9.4l6.3-.9L12 2.8z" />
                </svg>
              ))}
            </div>
          ) : null}
          <blockquote className="font-serif text-[15px] leading-relaxed md:text-base">
            “{longo && !aberto ? `${texto.slice(0, 250).trimEnd()}…` : texto}”
          </blockquote>
          {longo && (
            <button type="button" onClick={() => setAberto((a) => !a)} className="mt-1 text-xs font-bold text-accent">
              {aberto ? 'Ler menos' : 'Ler mais'}
            </button>
          )}
          <figcaption className="mt-3.5 flex items-center gap-2.5">
            {d.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.foto} alt={`Foto de ${d.nome}`} loading="lazy" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                {d.nome.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{d.nome}</span>
              {d.subtitulo && <span className="block text-xs text-[var(--text-muted)]">{semTravessoes(d.subtitulo)}</span>}
            </span>
          </figcaption>
        </div>
      </figure>
    </div>
  );
}

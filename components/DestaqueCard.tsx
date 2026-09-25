'use client';

import type { DestaqueCard as Dest } from '@/lib/especiais-tipos';
import { contarCliqueDestaque } from '@/lib/actions-especiais';
import { semTravessoes } from '@/lib/text';

// Card de DESTAQUE (propaganda própria) no feed: borda escura, barrinha com o selo
// ("Destaque", "Oportunidade", "Crédito"...) e botão para a página ou link.
export default function DestaqueCard({ d }: { d: Dest }) {
  const externo = !!d.link && /^https?:\/\//.test(d.link) && !d.link.includes('maisnovosimoveis.com');
  const conteudo = (
    <div className="overflow-hidden rounded-2xl border-2 border-ink bg-[var(--bg)] dark:border-[#3a3a3a]">
      <div className="flex items-center gap-1.5 bg-ink px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.1l-5.6 3 1.1-6.3L2.9 9.4l6.3-.9L12 2.8z" />
        </svg>
        {d.selo || 'Destaque'}
      </div>
      {d.imagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.imagem} alt={semTravessoes(d.titulo)} loading="lazy" className="block w-full object-cover" />
      )}
      <div className="p-4">
        <div className="font-serif text-lg font-semibold leading-snug">{semTravessoes(d.titulo)}</div>
        {d.texto && <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{semTravessoes(d.texto)}</p>}
        {d.link && (
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-white">
            {d.botao || 'Saiba mais'} →
          </span>
        )}
      </div>
    </div>
  );
  return (
    <div className="mb-2.5 inline-block w-full break-inside-avoid md:mb-4">
      {d.link ? (
        <a
          href={d.link}
          {...(externo ? { target: '_blank', rel: 'noopener sponsored' } : {})}
          onClick={() => {
            contarCliqueDestaque(d.id).catch(() => {});
          }}
          className="block transition-opacity hover:opacity-95"
        >
          {conteudo}
        </a>
      ) : (
        conteudo
      )}
    </div>
  );
}

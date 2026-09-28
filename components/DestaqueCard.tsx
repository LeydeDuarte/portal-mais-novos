'use client';

import type { DestaqueCard as Dest } from '@/lib/especiais-tipos';
import { contarCliqueDestaque } from '@/lib/actions-especiais';
import { semTravessoes } from '@/lib/text';

// Card de DESTAQUE (propaganda própria) no feed: borda escura, barrinha com o selo
// ("Destaque", "Oportunidade", "Crédito"...) e botão para a página ou link.
export default function DestaqueCard({ d }: { d: Dest }) {
  const externo = !!d.link && /^https?:\/\//.test(d.link) && !d.link.includes('maisnovosimoveis.com');
  const conteudo = (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
      {d.imagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.imagem} alt={semTravessoes(d.titulo)} loading="lazy" className="block w-full object-cover" />
      )}
      <div className="p-3.5">
        <div className="mb-1 flex items-center gap-1 text-[10.5px] font-semibold text-[var(--text-faint)]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.1l-5.6 3 1.1-6.3L2.9 9.4l6.3-.9L12 2.8z" />
          </svg>
          {d.selo && !/^destaque$/i.test(d.selo) ? d.selo : 'Publi'}
        </div>
        <div className="line-clamp-2 font-serif text-base font-semibold leading-snug">{semTravessoes(d.titulo)}</div>
        {d.texto && <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-[var(--text-muted)]">{semTravessoes(d.texto)}</p>}
        {d.link && <span className="mt-2 inline-block text-[12.5px] font-bold text-accent">{d.botao || 'Saiba mais'} →</span>}
      </div>
    </div>
  );
  return (
    <div className="mb-5 inline-block w-full break-inside-avoid md:mb-7">
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

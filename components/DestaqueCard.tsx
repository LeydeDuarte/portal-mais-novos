'use client';

import type { DestaqueCard as Dest } from '@/lib/especiais-tipos';
import { contarCliqueDestaque } from '@/lib/actions-especiais';
import { semTravessoes } from '@/lib/text';

// Card de DESTAQUE (propaganda própria) no feed: borda escura, barrinha com o selo
// ("Destaque", "Oportunidade", "Crédito"...) e botão para a página ou link.
/** Link do YouTube/Vimeo → vídeo que toca sozinho, sem som e em loop */
function videoAutoplay(url?: string | null): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&playsinline=1&modestbranding=1&rel=0`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?background=1&autoplay=1&muted=1&loop=1`;
  return null;
}

export default function DestaqueCard({ d, grande = false }: { d: Dest; grande?: boolean }) {
  const externo = !!d.link && /^https?:\/\//.test(d.link) && !d.link.includes('maisnovosimoveis.com');
  const embed = videoAutoplay(d.videoUrl);
  const conteudo = (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
      {embed ? (
        <div className={`relative w-full overflow-hidden bg-black ${grande ? 'aspect-[4/5]' : 'aspect-video'}`}>
          <iframe
            src={embed}
            title={semTravessoes(d.titulo)}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
            className="pointer-events-none absolute left-1/2 top-1/2 h-full min-w-full -translate-x-1/2 -translate-y-1/2 [aspect-ratio:16/9]"
          />
        </div>
      ) : (
        d.imagem && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.imagem} alt={semTravessoes(d.titulo)} loading="lazy" className={`block w-full object-cover ${grande ? 'aspect-[4/5]' : ''}`} />
        )
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
    <div className="surgir mb-5 inline-block w-full break-inside-avoid md:mb-7">
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

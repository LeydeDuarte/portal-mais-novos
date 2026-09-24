'use client';

import { useCallback, useEffect, useState } from 'react';
import SeloVendido from '@/components/SeloVendido';

export type GalleryVideo = {
  embedUrl: string; // link de incorporação (YouTube com autoplay sem som, ou Instagram)
  platform: 'youtube' | 'instagram';
  ratio?: number; // largura / altura do vídeo (ex: 16/9 deitado, 9/16 em pé) — padrão 16/9
};

type Props = {
  photos: string[];
  alt: string;
  video?: GalleryVideo | null; // quando existe, ocupa o lugar da foto principal
  badges?: React.ReactNode; // selos (Lançamento, Aceita temporada...) sobre o item principal
  vendido?: boolean; // tag VENDIDO no centro do item principal
  marcaDagua?: string; // texto repetido por cima das fotos (link privado: telefone de quem recebeu)
};

// Marca d'água em mosaico: se alguém tirar print e mandar num grupo, dá para saber de onde veio
function MarcaDagua({ texto }: { texto: string }) {
  const linhas = Array.from({ length: 9 });
  return (
    <div className="pointer-events-none absolute inset-0 z-[6] select-none overflow-hidden" aria-hidden>
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-col justify-around">
        {linhas.map((_, i) => (
          <div key={i} className="whitespace-nowrap text-[13px] font-bold tracking-wide text-white/35 [text-shadow:0_0_2px_rgba(0,0,0,0.35)]" style={{ marginLeft: i % 2 ? '-6em' : 0 }}>
            {Array.from({ length: 8 }).map(() => `${texto}  ·  `).join('')}
          </div>
        ))}
      </div>
    </div>
  );
}

type Item = { kind: 'video'; video: GalleryVideo } | { kind: 'photo'; url: string };

// Na tela cheia o vídeo ganha controles (som, pausa, tela cheia do próprio YouTube)
function fullscreenUrl(v: GalleryVideo): string {
  if (v.platform !== 'youtube') return v.embedUrl;
  return v.embedUrl.replace('controls=0', 'controls=1').replace('fs=0', 'fs=1').replace('disablekb=1', 'disablekb=0');
}

function VideoFrame({ video, title, fullscreen }: { video: GalleryVideo; title: string; fullscreen?: boolean }) {
  // Proporção real do vídeo (largura / altura). O iframe nasce exatamente nessa
  // proporção — assim o próprio player não coloca faixas pretas — e:
  // - na galeria: "cobre" o espaço inteiro, cortando as sobras (como foto de capa)
  // - na tela cheia: aparece inteiro, com controles
  const r = video.ratio && video.ratio > 0 ? video.ratio : video.platform === 'instagram' ? 9 / 16 : 16 / 9;
  const size = fullscreen
    ? { width: `min(100cqw, calc(100cqh * ${r}))`, height: `min(100cqh, calc(100cqw / ${r}))` }
    : { width: `max(100cqw, calc(100cqh * ${r}))`, height: `max(100cqh, calc(100cqw / ${r}))` };
  return (
    <div className={`absolute inset-0 overflow-hidden ${fullscreen ? '' : 'bg-[var(--card-img-bg)]'}`} style={{ containerType: 'size' }}>
      <iframe
        src={fullscreen ? fullscreenUrl(video) : video.embedUrl}
        title={title}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ border: 0, ...size, pointerEvents: fullscreen ? 'auto' : 'none' }}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        tabIndex={fullscreen ? 0 : -1}
      />
    </div>
  );
}

function VideoTag() {
  return (
    <span className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-ink/75 px-2.5 py-1 text-xs font-bold text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-green-400 dot-pulse" /> Vídeo
    </span>
  );
}

// Galeria da página do imóvel/empreendimento:
// - com vídeo: o vídeo toca sozinho (sem som, em loop) no lugar da foto principal
// - sem vídeo: a foto de capa ocupa esse lugar
// - computador: mosaico com o item principal grande à esquerda e 4 fotos menores à direita
// - celular: carrossel deslizando para o lado
// Clicar em qualquer item abre a tela cheia, com setas, contador e miniaturas.
export default function PhotoGallery({ photos, alt, video, badges, vendido, marcaDagua }: Props) {
  const items: Item[] = [...(video ? [{ kind: 'video' as const, video }] : []), ...photos.map((url) => ({ kind: 'photo' as const, url }))];
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const go = useCallback((delta: number) => setOpen((i) => (i == null ? i : (i + delta + items.length) % items.length)), [items.length]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, go]);

  if (!items.length) return null;
  const main = items[0];
  const side = items.slice(1, 5);
  const photoCount = photos.length;
  const countLabel = [video ? 'vídeo' : null, photoCount ? `${photoCount} ${photoCount === 1 ? 'foto' : 'fotos'}` : null].filter(Boolean).join(' + ');

  const renderThumb = (item: Item, index: number, extraClass = '') =>
    item.kind === 'video' ? (
      <VideoFrame video={item.video} title={`${alt} — vídeo`} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.url}
        alt={`${alt} — foto ${video ? index : index + 1}`}
        loading={index < 2 ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={index === 0 ? 'high' : 'auto'}
        draggable={false}
        className={`h-full w-full object-cover ${extraClass}`}
      />
    );

  return (
    <>
      {/* Celular: carrossel */}
      <div className="relative -mx-5 md:hidden">
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, i) => (
            <button
              key={item.kind === 'video' ? 'video' : item.url}
              type="button"
              onClick={() => setOpen(i)}
              className="relative aspect-[4/3] w-[88%] shrink-0 snap-center overflow-hidden rounded-2xl bg-[var(--card-img-bg)]"
            >
              {renderThumb(item, i)}
              {i === 0 && badges && <div className="absolute left-3 top-3 z-[7]">{badges}</div>}
              {item.kind === 'video' && <VideoTag />}
              {i === 0 && vendido && <SeloVendido grande />}
              {marcaDagua && <MarcaDagua texto={marcaDagua} />}
            </button>
          ))}
        </div>
        {items.length > 1 && (
          <span className="pointer-events-none absolute right-8 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">{countLabel}</span>
        )}
      </div>

      {/* Computador: mosaico */}
      <div
        className={`relative hidden h-[460px] gap-2 overflow-hidden rounded-2xl md:grid ${
          side.length === 0 ? 'grid-cols-1' : side.length === 1 ? 'grid-cols-2' : 'grid-cols-[2fr_1fr_1fr]'
        }`}
      >
        <button type="button" onClick={() => setOpen(0)} className="relative h-full overflow-hidden bg-[var(--card-img-bg)]">
          {renderThumb(main, 0, 'transition-transform duration-300 hover:scale-[1.02]')}
          {badges && <div className="absolute left-3 top-3 z-[7]">{badges}</div>}
          {main.kind === 'video' && <VideoTag />}
          {vendido && <SeloVendido grande />}
        </button>
        {side.length === 1 && (
          <button type="button" onClick={() => setOpen(1)} className="relative h-full overflow-hidden bg-[var(--card-img-bg)]">
            {renderThumb(side[0], 1, 'transition-transform duration-300 hover:scale-[1.02]')}
          </button>
        )}
        {side.length > 1 &&
          [0, 1].map((col) => (
            <div key={col} className="grid h-full gap-2" style={{ gridTemplateRows: side[col + 2] ? '1fr 1fr' : '1fr' }}>
              {[col, col + 2]
                .filter((k) => side[k])
                .map((k) => (
                  <button key={k} type="button" onClick={() => setOpen(k + 1)} className="relative h-full overflow-hidden bg-[var(--card-img-bg)]">
                    {renderThumb(side[k], k + 1, 'transition-transform duration-300 hover:scale-[1.02]')}
                  </button>
                ))}
            </div>
          ))}
        {marcaDagua && <MarcaDagua texto={marcaDagua} />}
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen(video ? 1 : 0)}
            className="absolute bottom-4 right-4 z-[7] rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-md hover:bg-white/90"
          >
            Ver todas as {photoCount} fotos
          </button>
        )}
      </div>

      {/* Tela cheia */}
      {open != null && (
        <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-[#0e0e0f]" role="dialog" aria-modal="true" aria-label="Fotos e vídeo">
          <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-white">
            <span>
              {open + 1} / {items.length}
              {items[open].kind === 'video' ? ' · Vídeo' : ''}
            </span>
            <button type="button" onClick={close} className="rounded-full px-3 py-1.5 hover:bg-white/10" aria-label="Fechar">
              ✕ Fechar
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 md:px-16">
            {(() => {
              const item = items[open];
              if (item.kind === 'video') {
                return (
                  <div className="relative h-full w-full">
                    <VideoFrame video={item.video} title={`${alt} — vídeo`} fullscreen />
                  </div>
                );
              }
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={`${alt} — foto`} className="h-full max-h-full w-full max-w-full object-contain" />
              );
            })()}
            {marcaDagua && <MarcaDagua texto={marcaDagua} />}
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Anterior"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25 md:left-4"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Próximo"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25 md:right-4"
                >
                  ›
                </button>
              </>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item, i) => (
              <button
                key={item.kind === 'video' ? 'video' : item.url}
                type="button"
                onClick={() => setOpen(i)}
                className={`relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ink ${
                  i === open ? 'ring-2 ring-accent' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {item.kind === 'video' ? (
                  <span className="text-xs font-bold text-white">▶ Vídeo</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

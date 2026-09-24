'use client';

import TemporadaBadge from '@/components/TemporadaBadge';
import SeloVendido from '@/components/SeloVendido';
import Visualizacoes from '@/components/Visualizacoes';
import CondominioTag from '@/components/CondominioTag';
import ImagemCapa from '@/components/ImagemCapa';
import { altFoto } from '@/lib/seo';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Property } from '@/lib/mock-properties';
import { useVideoAutoplay } from '@/lib/video-rotation';
import { getEmbedInfo } from '@/lib/video-embed';
import { getStatusBadge } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';

type Props = {
  property: Property;
  isFavorite: boolean;
  loggedIn: boolean;
  onFavoriteClick: (id: string) => void;
  onDwell: (id: string, ms: number) => void;
  prioridade?: boolean;
};

const BED_PATH = 'M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6 M3 18h18 M5 10V7a2 2 0 0 1 2-2h3v5';
const BATH_PATH = 'M4 12h16 M6 12V6a2 2 0 0 1 2-2h1 M6 20v-2 M18 20v-2';
const CAR_ICON = (
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </>
);
const AREA_ICON = (
  <>
    <path d="M3 3h7v7H3z" />
    <path d="M14 14h7v7h-7z" />
    <path d="M10 6.5h4" />
    <path d="M17.5 10v4" />
  </>
);

function Spec({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] md:text-xs">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      {children}
    </span>
  );
}

export default function PropertyCard({ property, isFavorite, loggedIn, onFavoriteClick, onDwell, prioridade = false }: Props) {
  const embed = property.videoUrl ? getEmbedInfo(property.videoUrl) : null;
  // Instagram não faz autoplay em embed (exige clique, às vezes até redireciona
  // pra fora do site) — só entra na roleta de autoplay do feed quem é YouTube
  // (toca de verdade) ou não tem link nenhum (simulação antiga, só visual).
  const eligibleForFeedAutoplay = property.video && embed?.platform !== 'instagram';
  const { ref: videoRef, isPlaying } = useVideoAutoplay(property.id, property.matchScore, eligibleForFeedAutoplay);
  const dwellRef = useRef<HTMLDivElement | null>(null);
  const enteredAt = useRef<number | null>(null);

  // Tempo de permanência do card na tela — matéria-prima do motor de recomendação
  // (ver "Login sob demanda e coleta comportamental" no documento de arquitetura).
  useEffect(() => {
    const node = dwellRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          enteredAt.current = Date.now();
        } else if (enteredAt.current) {
          onDwell(property.id, Date.now() - enteredAt.current);
          enteredAt.current = null;
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.id]);

  const setRefs = (node: HTMLDivElement | null) => {
    dwellRef.current = node;
    if (property.video) videoRef.current = node;
  };

  const badge = getStatusBadge(property.deliveryDate);

  return (
    <div className="mb-2.5 inline-block w-full break-inside-avoid md:mb-4">
      <Link href={`/imovel/${property.id}`} className="block">
        <div
          ref={setRefs}
          className={`group relative flex items-center justify-center overflow-hidden rounded-2xl bg-[var(--card-img-bg)] ${
            isPlaying && !embed ? 'video-playing' : ''
          }`}
          style={{ height: property.height }}
        >
          {isPlaying && embed ? (
            <iframe
              src={embed.embedUrl}
              className="absolute left-1/2 top-1/2 h-[300%] w-[300%] -translate-x-1/2 -translate-y-1/2"
              style={{ border: 0, pointerEvents: 'none' }}
              allow="autoplay; encrypted-media; picture-in-picture"
              tabIndex={-1}
              title="Vídeo do imóvel"
            />
          ) : property.photos && property.photos[0] ? (
            <ImagemCapa
              mini={property.capaMini}
              original={property.photos[0]}
              alt={altFoto(property)}
              prioridade={prioridade}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <span className="text-[11px] text-[var(--text-faint)]">{property.video ? '[CAPA EM VÍDEO]' : '[FOTO]'}</span>
          )}

          {property.vendidoEm && <SeloVendido />}
          <Visualizacoes n={property.visualizacoes} className="absolute bottom-2.5 left-2.5 z-10" />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

          <div className="absolute left-2.5 right-12 top-2.5 z-10 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: badge.bg, color: badge.color }}
            >
              {badge.text}
            </span>
            {property.finalidade === 'aluguel' && (
              <span className="rounded-md bg-ink/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                Aluguel
              </span>
            )}
            {property.aceitaTemporada && (
              <TemporadaBadge compacto />
            )}
            {property.video && (
              <span className="flex items-center gap-1 rounded-md bg-ink/70 px-2 py-1 text-[10px] font-bold text-white">
                <span className={`h-1.5 w-1.5 rounded-full bg-green-400 ${isPlaying ? 'opacity-100 dot-pulse' : 'opacity-0'}`} />
                Vídeo
              </span>
            )}
          </div>

          <button
            type="button"
            aria-label="Favoritar imóvel"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFavoriteClick(property.id);
            }}
            className={`absolute right-2 top-2 z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full transition-transform hover:scale-105 ${
              isFavorite ? 'bg-accent' : 'bg-ink/40'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? '#fff' : 'rgba(255,255,255,0.85)'} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.6 6.9 4.3 5.4c2.2-1.2 4.9-.5 6.2 1.6l1.5 2.4 1.5-2.4c1.3-2.1 4-2.8 6.2-1.6 2.7 1.5 3.3 4.7 1.6 7.4C18.7 16.65 12 21 12 21z" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-0.5 pt-2">
          {property.condominio && (
            <div className="mb-0.5 min-w-0">
              <CondominioTag nome={property.condominio} />
            </div>
          )}
          <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[property.tipoUnidade]}</div>
          <div className="font-sans tabular-nums text-sm font-bold tracking-tight md:text-base">{property.price}</div>
          <div className="text-xs text-[var(--text-muted)] md:text-[13px]">
            {property.location}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
            <Spec icon={<path d={BED_PATH} />}>{property.beds}</Spec>
            <Spec icon={CAR_ICON}>{property.parking}</Spec>
            {property.banheiros && <Spec icon={<path d={BATH_PATH} />}>{property.banheiros}</Spec>}
            <Spec icon={AREA_ICON}>{property.area}</Spec>
          </div>
        </div>
      </Link>
    </div>
  );
}

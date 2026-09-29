'use client';

import Link from 'next/link';
import { Caracteristica, IconeCama, IconeMetragem } from './IconesImovel';
import Visualizacoes from '@/components/Visualizacoes';
import AnunciosBadge from '@/components/AnunciosBadge';
import ImagemCapa from '@/components/ImagemCapa';
import TemporadaBadge from '@/components/TemporadaBadge';
import type { DevelopmentCardData } from '@/lib/actions';
import { getBadgeCondominio } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { urlImovel, urlCondominio } from '@/lib/urls';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatBRL(value: number): string {
  if (value >= 1_000_000) {
    const mi = value / 1_000_000;
    return `R$ ${mi.toLocaleString('pt-BR', { maximumFractionDigits: mi < 10 ? 2 : 1 })} mi`;
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function range(min: number | null, max: number | null, suffix: string): string | null {
  if (min == null && max == null) return null;
  if (min === max || max == null) return `${min}${suffix}`;
  if (min == null) return `${max}${suffix}`;
  return `${min} a ${max}${suffix}`;
}

// Card de empreendimento/condomínio no feed — mesmo estilo do card de imóvel,
// mas mostrando o resumo do condomínio: tipos que existem, faixa de quartos e
// metragem, "a partir de" e a data de entrega.
function youtubeAutoplay(url?: string): string | null {
  const m = url?.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}&controls=0&playsinline=1&modestbranding=1&rel=0` : null;
}

export default function DevelopmentCard({ development, prioridade = false, emDestaque = false }: { development: DevelopmentCardData; prioridade?: boolean; emDestaque?: boolean }) {
  // no espaço de destaque, o vídeo do condomínio toca sozinho (sem som)
  const videoDestaque = emDestaque ? youtubeAutoplay(development.videoUrl) : null;
  const badge = getBadgeCondominio(development.deliveryDate, development.tipo);
  const cover = development.photos[0];
  const [ano, mes] = development.deliveryDate.split('-');
  const tipos = development.tiposUnidade.map((t) => TIPO_UNIDADE_LABEL[t]).filter(Boolean);
  const quartos = range(development.quartosMin, development.quartosMax, ' qts');
  const area = range(
    development.areaMin != null ? Math.round(development.areaMin) : null,
    development.areaMax != null ? Math.round(development.areaMax) : null,
    ' m²'
  );
  // Quartos com a caminha: "4", "2 e 3" ou "2 a 4"; metragens com a seta: "50 a 239 m²"
  const qMin = development.quartosMin;
  const qMax = development.quartosMax ?? qMin;
  const quartosTxt = qMin == null ? null : qMin === qMax ? `${qMin}` : qMax === qMin + 1 ? `${qMin} e ${qMax}` : `${qMin} a ${qMax}`;
  const aMin = development.areaMin != null ? Math.round(development.areaMin) : null;
  const aMax = development.areaMax != null ? Math.round(development.areaMax) : aMin;
  const areaTxt = aMin == null ? null : aMin === aMax ? `${aMin} m²` : `${aMin} a ${aMax} m²`;
  // Concepção: só os nomes, no máximo 2 empresas no card (as demais na página do condomínio)
  const empresas = (development.concepcao ?? '').split(' · ').filter(Boolean).slice(0, 2).join(' · ');
  const icones = (quartosTxt || areaTxt) && (
    <div className="mt-1 flex flex-wrap items-center gap-3">
      <Caracteristica icone={<IconeCama />} valor={quartosTxt} titulo="Quartos" />
      <Caracteristica icone={<IconeMetragem />} valor={areaTxt} titulo="Metragens" />
    </div>
  );

  // Sem foto: card compacto, só com as informações (não mostra espaço de foto vazio)
  if (!cover) {
    return (
      <div className="mb-5 inline-block w-full break-inside-avoid md:mb-7">
        <Link href={urlCondominio(development)} className="block rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 transition-colors hover:bg-[var(--pill-bg)] md:border-[#E7EAEE] md:bg-[#F6F7F9] md:hover:bg-[#EEF1F4]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: badge.bg, color: badge.color }}>
              {badge.text}
            </span>
            <span className="rounded-md bg-[var(--pill-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">Condomínio</span>
            <span className="ml-auto flex items-center gap-1.5">
              <AnunciosBadge n={development.anuncios} />
              <Visualizacoes n={development.visualizacoes} />
            </span>
          </div>
          <div className="mt-2.5 font-serif text-base font-semibold leading-tight md:text-lg">{development.name}</div>
          <div className="text-xs text-[var(--text-muted)] md:text-[13px]">{development.location}</div>
          {empresas && <div className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-faint)]">{empresas}</div>}
          {icones}
          {tipos.length > 0 && <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-accent">{tipos.slice(0, 4).join(' · ')}</div>}
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            {development.unitsCount > 0
              ? [development.minPrice ? `A partir de ${formatBRL(development.minPrice)}` : null, `${development.unitsCount} tipologia(s)`].filter(Boolean).join(' · ')
              : 'Sem anúncios no momento. Registre seu interesse'}
          </div>
          <span className="mt-2 inline-block text-xs font-semibold text-accent">Ver condomínio →</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-5 inline-block w-full break-inside-avoid md:mb-7">
      <Link href={urlCondominio(development)} className="block">
        <div
          className="feed-midia group relative flex items-center justify-center overflow-hidden rounded-2xl bg-[var(--card-img-bg)]"
          style={{ height: development.height }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <ImagemCapa mini={development.capaMini} original={cover} alt={`${development.name}, ${development.location} | Mais Novos Imóveis`} prioridade={prioridade} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] text-[var(--text-faint)]">[FOTO DO EMPREENDIMENTO]</span>
          )}
          {videoDestaque && (
            <iframe
              src={videoDestaque}
              title={development.name}
              allow="autoplay; encrypted-media"
              className="pointer-events-none absolute left-1/2 top-1/2 h-full -translate-x-1/2 -translate-y-1/2 [aspect-ratio:16/9] min-w-full"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
          <div className="absolute left-2.5 right-2.5 top-2.5 z-10 flex flex-wrap items-center gap-1.5">
            <AnunciosBadge n={development.anuncios} />
            <Visualizacoes n={development.visualizacoes} />
            <span className="whitespace-nowrap rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: badge.bg, color: badge.color }}>
              {badge.text}
            </span>
            <span className="rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink">Empreendimento</span>
            {development.aceitaTemporada && (
              <TemporadaBadge compacto />
            )}
          </div>

          <div className="absolute bottom-3 left-3 right-3 z-10 text-white">
            <div className="font-serif text-base font-semibold leading-tight drop-shadow md:text-lg">{development.name}</div>
            <div className="text-[11px] opacity-90 md:text-xs">
              {development.tipo === 'horizontal' ? 'Condomínio entregue' : 'Entrega'} {ano ? `${MESES[Number(mes) - 1] ?? mes}/${ano}` : '--/----'}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 pt-2">
          {tipos.length > 0 && (
            <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{tipos.slice(0, 4).join(' · ')}{tipos.length > 4 ? ' +' : ''}</div>
          )}
          <div className="font-sans tabular-nums text-sm font-bold tracking-tight md:text-base">
            {development.minPrice ? `A partir de ${formatBRL(development.minPrice)}` : 'Preço sob consulta'}
          </div>
          <div className="text-xs text-[var(--text-muted)] md:text-[13px]">{development.location}</div>
          {empresas && <div className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-faint)]">{empresas}</div>}
          {icones}
          {development.unitsCount > 0 && <div className="mt-0.5 text-[11px] text-[var(--text-muted)] md:text-xs">{development.unitsCount} tipologia(s)</div>}
        </div>
      </Link>
    </div>
  );
}

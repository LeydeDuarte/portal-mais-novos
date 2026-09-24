'use client';

import Link from 'next/link';
import type { DevelopmentCardData } from '@/lib/actions';
import { getStatusBadge } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';

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
export default function DevelopmentCard({ development }: { development: DevelopmentCardData }) {
  const badge = getStatusBadge(development.deliveryDate);
  const cover = development.photos[0];
  const [ano, mes] = development.deliveryDate.split('-');
  const tipos = development.tiposUnidade.map((t) => TIPO_UNIDADE_LABEL[t]).filter(Boolean);
  const quartos = range(development.quartosMin, development.quartosMax, ' qts');
  const area = range(
    development.areaMin != null ? Math.round(development.areaMin) : null,
    development.areaMax != null ? Math.round(development.areaMax) : null,
    ' m²'
  );

  // Sem foto: card compacto, só com as informações (não mostra espaço de foto vazio)
  if (!cover) {
    return (
      <div className="mb-2.5 inline-block w-full break-inside-avoid md:mb-4">
        <Link href={`/empreendimento/${development.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 transition-colors hover:bg-[var(--pill-bg)]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: badge.bg, color: badge.color }}>
              {badge.text}
            </span>
            <span className="rounded-md bg-[var(--pill-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">Condomínio</span>
          </div>
          <div className="mt-2.5 font-serif text-base font-semibold leading-tight md:text-lg">{development.name}</div>
          <div className="text-xs text-[var(--text-muted)] md:text-[13px]">{development.location}</div>
          {tipos.length > 0 && <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-accent">{tipos.slice(0, 4).join(' · ')}</div>}
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            {development.unitsCount > 0
              ? [development.minPrice ? `A partir de ${formatBRL(development.minPrice)}` : null, quartos, area].filter(Boolean).join(' · ')
              : 'Sem anúncios no momento — registre seu interesse'}
          </div>
          <span className="mt-2 inline-block text-xs font-semibold text-accent">Ver condomínio →</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-2.5 inline-block w-full break-inside-avoid md:mb-4">
      <Link href={`/empreendimento/${development.id}`} className="block">
        <div
          className="group relative flex items-center justify-center overflow-hidden rounded-2xl bg-[var(--card-img-bg)]"
          style={{ height: development.height }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={development.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] text-[var(--text-faint)]">[FOTO DO EMPREENDIMENTO]</span>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />

          <div className="absolute left-2.5 right-2.5 top-2.5 z-10 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: badge.bg, color: badge.color }}>
              {badge.text}
            </span>
            <span className="rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink">Empreendimento</span>
            {development.aceitaTemporada && (
              <span className="rounded-md bg-emerald-700/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Aceita temporada</span>
            )}
          </div>

          <div className="absolute bottom-3 left-3 right-3 z-10 text-white">
            <div className="font-serif text-base font-semibold leading-tight drop-shadow md:text-lg">{development.name}</div>
            <div className="text-[11px] opacity-90 md:text-xs">
              Entrega {MESES[Number(mes) - 1] ?? mes}/{ano}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 pt-2">
          {tipos.length > 0 && (
            <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{tipos.slice(0, 4).join(' · ')}{tipos.length > 4 ? ' +' : ''}</div>
          )}
          <div className="font-serif text-sm font-semibold md:text-base">
            {development.minPrice ? `A partir de ${formatBRL(development.minPrice)}` : 'Preço sob consulta'}
          </div>
          <div className="text-xs text-[var(--text-muted)] md:text-[13px]">{development.location}</div>
          {(quartos || area || development.unitsCount > 0) && (
            <div className="mt-0.5 text-[11px] text-[var(--text-muted)] md:text-xs">
              {[quartos, area, development.unitsCount > 0 ? `${development.unitsCount} tipologia(s)` : null].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

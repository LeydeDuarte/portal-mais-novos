import Link from 'next/link';
import type { PropertyDetail } from '@/lib/property-details';
import { getStatusBadge } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';

type Props = {
  title: string;
  subtitle?: string;
  items: PropertyDetail[];
  emptyText?: string; // se vier, mostra a seção mesmo vazia
};

// Faixa de cards (desliza para o lado) com imóveis relacionados — usada no fim
// da página do imóvel e do condomínio.
export default function RelatedListings({ title, subtitle, items, emptyText }: Props) {
  if (!items.length && !emptyText) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{subtitle}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">{emptyText}</p>
      ) : (
        <div className="-mx-5 mt-4 flex snap-x gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] md:mx-0 md:px-0">
          {items.map((p) => {
            const badge = getStatusBadge(p.deliveryDate);
            const cover = p.photos?.[0];
            return (
              <Link key={p.id} href={`/imovel/${p.id}`} className="group w-[230px] shrink-0 snap-start">
                <div className="relative h-[160px] overflow-hidden rounded-2xl bg-[var(--card-img-bg)]">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[11px] text-[var(--text-faint)]">[FOTO]</span>
                  )}
                  <span
                    className="absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {badge.text}
                  </span>
                </div>
                <div className="pt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[p.tipoUnidade]}</div>
                  <div className="font-serif text-base font-semibold">{p.price}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">
                    {p.condominio ? `${p.condominio} · ` : ''}
                    {p.bairro || p.location}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {[p.beds !== '—' ? p.beds : null, p.parking !== '—' ? p.parking : null, p.area !== '—' ? p.area : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function faixaDePreco(preco: number | null): string | undefined {
  if (!preco) return undefined;
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
      : `R$ ${Math.round(n / 1000).toLocaleString('pt-BR')} mil`;
  return `Parecidos com este — mesmo tipo, quartos e metragem próximos — entre ${fmt(preco * 0.65)} e ${fmt(preco * 1.35)}.`;
}

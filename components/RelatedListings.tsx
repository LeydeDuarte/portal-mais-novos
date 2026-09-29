import { LinhaCaracteristicas } from '@/components/IconesImovel';
import SeloVendido from '@/components/SeloVendido';
import LinhaCondominioCorretor from '@/components/LinhaCondominioCorretor';
import Link from 'next/link';
import ImagemCapa from '@/components/ImagemCapa';
import ScrollRow from './ScrollRow';
import { formatTitulo } from '@/lib/text';
import type { PropertyDetail } from '@/lib/property-details';
import { getStatusBadge } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { urlImovel, urlCondominio } from '@/lib/urls';

type Props = {
  title: string;
  subtitle?: string;
  items: PropertyDetail[];
  emptyText?: string; // se vier, mostra a seção mesmo vazia
  grade?: boolean; // grade (2 colunas no celular, 4 no computador) em vez da faixa que desliza
  limite?: number;
};

// Faixa de cards (desliza para o lado) com imóveis relacionados — usada no fim
// da página do imóvel e do condomínio.
export default function RelatedListings({ title, subtitle, items, emptyText, grade = false, limite }: Props) {
  items = limite ? items.slice(0, limite) : items;
  if (!items.length && !emptyText) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{subtitle}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">{emptyText}</p>
      ) : (
        <div className={grade ? 'mt-4' : '-mx-5 mt-4 md:mx-0'}>
        <Faixa grade={grade}>
          {items.map((p) => {
            const badge = getStatusBadge(p.deliveryDate);
            const cover = p.photos?.[0];
            return (
              <Link key={p.id} href={urlImovel(p)} className={`group ${grade ? 'min-w-0' : 'w-[230px] shrink-0 snap-start'}`}>
                <div className={`relative overflow-hidden rounded-2xl bg-[var(--card-img-bg)] ${grade ? 'aspect-[4/3]' : 'h-[160px]'}`}>
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <ImagemCapa
                      mini={p.capaMini}
                      original={cover}
                      alt={`${TIPO_UNIDADE_LABEL[p.tipoUnidade]}${p.condominio ? ` no ${formatTitulo(p.condominio)}` : ''}, ${p.bairro || p.location}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[11px] text-[var(--text-faint)]">[FOTO]</span>
                  )}
                  <span
                    className="absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {badge.text}
                  </span>
                  <span
                    className={`absolute bottom-2.5 left-2.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      p.finalidade === 'aluguel' ? 'bg-sky-700 text-white' : 'bg-white/95 text-ink'
                    }`}
                  >
                    {p.vendidoEm ? 'Vendido' : p.finalidade === 'aluguel' ? 'Aluguel' : 'À venda'}
                  </span>
                  {p.vendidoEm && <SeloVendido />}
                </div>
                <div className="pt-2">
                  <LinhaCondominioCorretor condominio={p.condominio ? formatTitulo(p.condominio) : null} corretor={p.corretor} />
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[p.tipoUnidade]}</div>
                  <div className="font-sans tabular-nums text-[17px] font-bold tracking-tight">{p.price}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">
                    {p.bairro || p.location}
                  </div>
                  <LinhaCaracteristicas beds={p.beds} banheiros={p.banheiros} parking={p.parking} area={p.areaValue} />
                </div>
              </Link>
            );
          })}
        </Faixa>
        </div>
      )}
    </section>
  );
}

function Faixa({ grade, children }: { grade: boolean; children: React.ReactNode }) {
  return grade ? (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4">{children}</div>
  ) : (
    <ScrollRow className="snap-x gap-4 px-5 pb-2 md:px-0">{children}</ScrollRow>
  );
}

export function faixaDePreco(preco: number | null): string | undefined {
  if (!preco) return undefined;
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
      : `R$ ${Math.round(n / 1000).toLocaleString('pt-BR')} mil`;
  return `Parecidos com este (mesmo tipo, quartos e metragem próximos), entre ${fmt(preco * 0.65)} e ${fmt(preco * 1.35)}.`;
}

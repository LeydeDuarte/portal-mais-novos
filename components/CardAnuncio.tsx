import Link from 'next/link';
import ImagemCapa from '@/components/ImagemCapa';
import CondominioTag from '@/components/CondominioTag';
import SeloVendido from '@/components/SeloVendido';
import { getStatusBadge } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { altFoto } from '@/lib/seo';
import type { PropertyDetail } from '@/lib/property-details';

// Card simples (renderizado no servidor) para as páginas de região — leve e
// 100% legível pelo Google e pelos buscadores de IA.
export default function CardAnuncio({ p, prioridade = false }: { p: PropertyDetail; prioridade?: boolean }) {
  const badge = getStatusBadge(p.deliveryDate);
  const capa = p.photos?.[0];
  return (
    <Link href={`/imovel/${p.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[var(--card-img-bg)]">
        {capa ? (
          <ImagemCapa mini={p.capaMini} original={capa} alt={altFoto(p)} prioridade={prioridade} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <span className="flex h-full items-center justify-center text-[11px] text-[var(--text-faint)]">[FOTO]</span>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: badge.bg, color: badge.color }}>
          {badge.text}
        </span>
        {p.vendidoEm && <SeloVendido />}
      </div>
      <div className="flex flex-col gap-0.5 pt-2">
        {p.condominio && (
          <div className="mb-0.5 min-w-0">
            <CondominioTag nome={p.condominio} />
          </div>
        )}
        <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[p.tipoUnidade]}</div>
        <div className="font-sans text-base font-bold tabular-nums tracking-tight">{p.price}</div>
        <div className="text-xs text-[var(--text-muted)]">{p.location}</div>
        <div className="text-xs text-[var(--text-muted)]">{[p.beds !== '-' ? p.beds : null, p.parking !== '-' ? p.parking : null, p.area !== '-' ? p.area : null].filter(Boolean).join(' · ')}</div>
      </div>
    </Link>
  );
}

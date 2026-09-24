import Link from 'next/link';
import type { AnuncioOculto } from '@/lib/actions';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { brlCurto } from '@/lib/ocultos';

// Card de anúncio RESERVADO (privado): só características — sem foto, título
// ou endereço. Leva para a página do anúncio, onde a pessoa pede para ver.
export default function OcultoCard({ a }: { a: AnuncioOculto }) {
  return (
    <Link
      href={`/imovel/${a.id}`}
      className="group flex flex-col gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--pill-bg)]/60 p-4 transition-colors hover:border-accent hover:bg-[var(--bg)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[a.tipoUnidade]}</span>
        <span className="flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Reservado
        </span>
      </div>
      <div className="font-sans text-lg font-bold tabular-nums tracking-tight">{a.preco ? brlCurto(a.preco) : 'Valor sob consulta'}</div>
      <div className="text-xs text-[var(--text-muted)]">
        {[a.quartos ? `${a.quartos} qts` : null, a.vagas ? `${a.vagas} vg` : null, a.area ? `${Math.round(a.area)} m²` : null].filter(Boolean).join(' · ')}
      </div>
      <div className="text-xs text-[var(--text-muted)]">{[a.condominio, a.bairro, a.cidade].filter(Boolean).join(' · ')}</div>
      {a.precoM2 && <div className="text-[11px] text-[var(--text-faint)]">{brlCurto(a.precoM2)}/m²</div>}
      <span className="mt-1 text-xs font-semibold text-accent group-hover:underline">Pedir para ver este imóvel →</span>
    </Link>
  );
}

// Gráfico: lançamentos e obras por incorporadora em Goiânia (barras empilhadas por fase)
import Link from 'next/link';
import type { IncorporadoraFases } from '@/lib/news/mercado';

const FASES = [
  { k: 'breve', nome: 'Breve lançamento', cor: '#9CC2FF' },
  { k: 'lancamento', nome: 'Lançamento', cor: '#257CFF' },
  { k: 'obras', nome: 'Em obras', cor: '#1E3A8A' }
] as const;

export default function GraficoIncorporadoras({ dados, titulo, completo = false, linkTexto = 'Ver o ranking completo →' }: { dados: IncorporadoraFases[]; titulo?: string; completo?: boolean; linkTexto?: string }) {
  if (!dados.length) return null;
  const max = Math.max(...dados.map((d) => d.total));
  const soma = dados.reduce((s, d) => s + d.total, 0);
  return (
    <section className="rounded-2xl border border-[var(--border)] p-5" aria-label="Lançamentos e obras por incorporadora em Goiânia">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-[22px] font-semibold">{titulo ?? 'Quem mais está construindo em Goiânia'}</h2>
        <span className="text-xs text-[var(--text-muted)]">Fonte: Mais Novos Imóveis</span>
      </div>
      {!titulo && <p className="mb-4 text-sm text-[var(--text-muted)]">Empreendimentos em breve lançamento, lançamento e obras, por incorporadora. {soma} projetos entre as 10 que mais constroem.</p>}
      {titulo && <p className="mb-4 text-sm text-[var(--text-muted)]">Empreendimentos em breve lançamento, lançamento e obras, por incorporadora.</p>}
      <div className="flex flex-col gap-2.5">
        {dados.map((d) => (
          <div key={d.nome} className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)_28px] items-center gap-3 text-sm md:grid-cols-[180px_minmax(0,1fr)_32px]">
            {d.slug ? (
              <Link href={`/empresa/${d.slug}`} className="truncate font-semibold hover:text-accent" title={d.nome}>
                {d.nome}
              </Link>
            ) : (
              <span className="truncate font-semibold">{d.nome}</span>
            )}
            <div className="flex h-5 overflow-hidden rounded-full bg-[var(--pill-bg)]" style={{ width: `${Math.max(8, (d.total / max) * 100)}%` }}>
              {FASES.map((f) =>
                d[f.k] > 0 ? <span key={f.k} title={`${f.nome}: ${d[f.k]}`} style={{ width: `${(d[f.k] / d.total) * 100}%`, backgroundColor: f.cor }} className="h-full" /> : null
              )}
            </div>
            <span className="text-right font-sans font-bold tabular-nums">{d.total}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
        {FASES.map((f) => (
          <span key={f.k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.cor }} />
            {f.nome}
          </span>
        ))}
        {completo && (
          <Link href="/news/incorporadoras" className="ml-auto font-semibold text-accent">
            {linkTexto}
          </Link>
        )}
      </div>
    </section>
  );
}

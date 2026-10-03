'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { listarAvaliacoesInternas, type AvaliacaoInterna } from '@/lib/actions-avaliacoes';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// Painel → Avaliação de imóveis (uso interno): avaliações salvas e o botão de nova avaliação.
export default function AvaliacoesPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [l, setL] = useState<AvaliacaoInterna[] | null>(null);
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff) listarAvaliacoesInternas().then(setL).catch(() => setL([]));
  }, [staff]);
  if (!loaded || !staff) return null;
  return (
    <div className="flex min-h-screen flex-col">
      <PainelNav />
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Avaliação de imóveis</h1>
            <p className="text-[13px] text-[var(--text-muted)]">Uso interno: relatório de avaliação com amostras da nossa base e dos portais.</p>
          </div>
          <Link href="/dashboard/avaliacoes/nova" className="rounded-full bg-accent px-4 py-2.5 text-[14px] font-semibold text-white">
            + Nova avaliação
          </Link>
        </div>
        {!l ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : l.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhuma avaliação ainda. Comece com "+ Nova avaliação".</p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)]">
            {l.map((a) => (
              <Link key={a.id} href={`/dashboard/avaliacoes/${a.id}`} className="flex items-center gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0 hover:bg-[var(--pill-bg)]">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{[a.imovel.condominio, a.imovel.bairro].filter(Boolean).join(', ')}</div>
                  <div className="text-[12.5px] text-[var(--text-muted)]">
                    {a.imovel.area} m²{a.imovel.quartos ? ` · ${a.imovel.quartos} qts` : ''}
                    {a.imovel.vagas != null ? ` · ${a.imovel.vagas} vg` : ''}
                    {a.imovel.ano ? ` · entrega ${a.imovel.ano}` : ''} · {new Date(a.criadoEm).toLocaleDateString('pt-BR')}
                    {a.criadoPor ? ` · ${a.criadoPor}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[15px] font-bold tabular-nums">{a.resultado ? brl(a.resultado.valor) : 'sem cálculo'}</div>
                  {a.resultado && <div className="text-[11.5px] text-[var(--text-muted)]">Grau {a.resultado.grau}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

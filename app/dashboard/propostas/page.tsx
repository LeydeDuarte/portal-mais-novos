'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { listarPropostas, type Proposta } from '@/lib/actions-propostas';
import { STATUS_PROPOSTA, brl } from '@/lib/proposta-textos';

// Propostas feitas pela equipe (uso interno). Corretor vê só as dele.
export default function PropostasPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [itens, setItens] = useState<Proposta[] | null>(null);
  const [filtro, setFiltro] = useState('todas');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff) listarPropostas().then(setItens).catch(() => setItens([]));
  }, [staff]);

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (itens ?? []).filter(
      (p) =>
        (filtro === 'todas' || p.status === filtro) &&
        (!t || [p.comprador.nome, p.imovelTexto, p.unidade, p.vendedor?.nome, p.corretor?.nome].filter(Boolean).join(' ').toLowerCase().includes(t))
    );
  }, [itens, filtro, q]);

  // várias propostas no mesmo imóvel: mostra quantas existem
  const porImovel = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of itens ?? []) {
      const k = p.propertyId ?? p.developmentId ?? '';
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [itens]);

  if (!loaded || !staff) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl font-semibold">Propostas</h1>
          <Link href="/dashboard/propostas/nova" className="ml-auto rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white">
            + Nova proposta
          </Link>
        </div>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Uso interno, nunca aparece no site. {veTudo(staff.role) ? 'Você vê as propostas de toda a equipe.' : 'Você vê só as propostas que fez.'}
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por comprador, imóvel, vendedor ou corretor"
          className="mt-5 w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {['todas', ...Object.keys(STATUS_PROPOSTA)].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFiltro(s)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold ${filtro === s ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
            >
              {s === 'todas' ? 'Todas' : STATUS_PROPOSTA[s]}
            </button>
          ))}
        </div>
        {itens === null ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhuma proposta aqui ainda.</p>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {lista.map((p) => {
              const n = porImovel.get(p.propertyId ?? p.developmentId ?? '') ?? 0;
              return (
                <Link key={p.id} href={`/dashboard/propostas/${p.id}`} className="block rounded-xl border border-[var(--border)] p-4 hover:border-accent">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-faint)]">Nº {String(p.numero).padStart(4, '0')}</span>
                    <span className="text-lg font-bold">{brl(p.valor)}</span>
                    <span className="rounded-md bg-[var(--pill-bg)] px-2 py-0.5 text-[11px] font-bold uppercase">{STATUS_PROPOSTA[p.status]}</span>
                    {n > 1 && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">{n} propostas neste imóvel</span>}
                    <span className="ml-auto text-xs text-[var(--text-muted)]">{new Date(p.criadoEm).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold">{p.comprador.nome}</div>
                  <div className="line-clamp-1 text-sm text-[var(--text-muted)]">
                    {p.imovelTexto}
                    {p.unidade ? ` · ${p.unidade}` : ''}
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">
                    Vendedor: {p.vendedor?.nome ?? 'não informado'} · Corretor: {p.corretor?.nome ?? p.criadoPor}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

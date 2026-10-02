'use client';

// Resumo dos custos do mês no topo de Painel → Resultados (detalhe em Painel → Custos).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { painelCustos, type PainelCustos } from '@/lib/actions-custos';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ResumoCustos() {
  const [d, setD] = useState<PainelCustos | null>(null);
  useEffect(() => {
    painelCustos().then(setD).catch(() => {});
  }, []);
  if (!d) return null;
  return (
    <Link href="/dashboard/custos" className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-5 py-4 hover:border-accent">
      <span>
        <span className="block text-[12.5px] font-semibold text-[var(--text-muted)]">Custos da operação neste mês</span>
        <b className="text-[22px] tabular-nums">{brl(d.totais.total)}</b>
      </span>
      <span className="text-sm text-[var(--text-muted)]">
        IA <b className="text-[var(--text)]">{brl(d.totais.iaBrl)}</b> · WhatsApp <b className="text-[var(--text)]">{brl(d.totais.whatsappBrl)}</b> · contas fixas{' '}
        <b className="text-[var(--text)]">{brl(d.totais.contasBrl)}</b>
        {d.ia.porAtendimentoBrl != null && <> · IA por cliente atendido {brl(d.ia.porAtendimentoBrl)}</>}
      </span>
      <span className="ml-auto text-sm font-semibold text-accent">Ver custos →</span>
    </Link>
  );
}

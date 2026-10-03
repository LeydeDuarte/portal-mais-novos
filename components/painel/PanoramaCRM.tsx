'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { crmPanorama, type Panorama } from '@/lib/actions-crm';
import { ETAPAS } from '@/lib/crm-tipos';

// Panorama do CRM no Início do painel. Cada um vê no seu nível:
// administrador e analista, a equipe toda; corretor, só os contatos dele.
const NOME_ETAPA = new Map<string, string>();
for (const lista of Object.values(ETAPAS)) for (const e of lista) if (!NOME_ETAPA.has(e.id)) NOME_ETAPA.set(e.id, e.nome);
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function Numero({ n, rotulo, detalhe, alerta, href }: { n: number; rotulo: string; detalhe?: string; alerta?: boolean; href: string }) {
  return (
    <Link href={href} className="flex flex-col rounded-2xl px-4 py-3 transition-colors hover:bg-[var(--pill-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <span className="text-[13px] font-semibold text-[var(--text-muted)]">{rotulo}</span>
      <span className={`text-[30px] font-bold leading-tight tabular-nums ${alerta ? 'text-[#C2410C]' : ''}`}>{n}</span>
      {detalhe && <span className="text-[12.5px] text-[var(--text-muted)]">{detalhe}</span>}
    </Link>
  );
}

export default function PanoramaCRM({ previa }: { previa?: Panorama } = {}) {
  const [p, setP] = useState<Panorama | null>(previa ?? null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (previa) return;
    crmPanorama().then(setP).catch(() => setErro(true));
  }, []);
  if (erro) return null;

  return (
    <section aria-labelledby="panorama-crm" className="rounded-[28px] border border-[var(--border)] p-2 md:p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2">
        <h2 id="panorama-crm" className="font-serif text-[19px] font-semibold tracking-tight">
          {p?.todaEquipe ? 'CRM da equipe hoje' : 'Seu CRM hoje'}
        </h2>
        <Link href="/dashboard/crm" className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-accent hover:bg-[var(--pill-bg)]">
          Abrir o CRM
        </Link>
      </div>
      {!p ? (
        <p className="px-3 py-6 text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4">
            <Numero href="/dashboard/crm" n={p.esperando} rotulo="Esperando resposta" detalhe={p.esperando ? 'responda primeiro' : 'ninguém esperando'} alerta={p.esperando > 0} />
            <Numero href="/dashboard/crm" n={p.tarefas} rotulo="Tarefas de hoje" detalhe={p.atrasadas ? `${p.atrasadas} atrasada(s)` : 'em dia'} alerta={p.atrasadas > 0} />
            <Numero href="/dashboard/crm" n={p.visitas} rotulo="Visitas hoje" detalhe="agendadas" />
            <Numero href="/dashboard/crm/contatos" n={p.novos7d} rotulo="Contatos novos" detalhe="nos últimos 7 dias" />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-3 pb-2 pt-3 text-[13px]">
            <Link href="/dashboard/crm/funil" className="font-semibold hover:text-accent">
              {p.negociosAbertos} negócio(s) em andamento
            </Link>
            {p.porEtapa.map((e) => (
              <span key={e.etapa} className="rounded-full bg-[var(--pill-bg)] px-2.5 py-1">
                {NOME_ETAPA.get(e.etapa) ?? e.etapa} <b className="tabular-nums">{e.n}</b>
              </span>
            ))}
            <span className="ml-auto text-[var(--text-muted)]">
              Ganhos no mês: <b className="text-[var(--text)]">{p.ganhosMes}</b>
              {p.valorGanhoMes > 0 && <> ({brl(p.valorGanhoMes)})</>}
              {p.todaEquipe && p.semDono > 0 && (
                <Link href="/dashboard/crm/equipe" className="ml-3 font-semibold text-[#C2410C] hover:underline">
                  {p.semDono} sem corretor
                </Link>
              )}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { listarCaptacoes, mudarStatusCaptacao, type Captacao } from '@/lib/actions-captacao';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';

const STATUS: Record<Captacao['status'], string> = { novo: 'Novo', contatado: 'Contatado', captado: 'Captado', descartado: 'Descartado' };
const FINALIDADE: Record<string, string> = { venda: 'Vender', aluguel: 'Alugar', venda_aluguel: 'Vender ou alugar' };
const brl = (n: number | null) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);
const tel = (d: string) => (d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d);

// Proprietários que preencheram "Venda seu imóvel" no site.
export default function QueroVenderPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [itens, setItens] = useState<Captacao[] | null>(null);
  const [filtro, setFiltro] = useState<'todos' | Captacao['status']>('todos');

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff) listarCaptacoes().then(setItens).catch(() => setItens([]));
  }, [staff]);

  if (!loaded || !staff) return null;
  const lista = (itens ?? []).filter((i) => filtro === 'todos' || i.status === filtro);

  const mudar = async (id: string, status: Captacao['status']) => {
    setItens((prev) => prev?.map((i) => (i.id === id ? { ...i, status } : i)) ?? prev);
    await mudarStatusCaptacao(id, status).catch(() => {});
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Quero vender</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Proprietários que cadastraram o imóvel na página &quot;Venda seu imóvel&quot; do site.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {(['todos', 'novo', 'contatado', 'captado', 'descartado'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFiltro(s)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold ${filtro === s ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
            >
              {s === 'todos' ? 'Todos' : STATUS[s]}
              {itens && s !== 'todos' ? ` (${itens.filter((i) => i.status === s).length})` : ''}
            </button>
          ))}
        </div>
        {itens === null ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum cadastro aqui ainda.</p>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {lista.map((c) => {
              const num = c.telefone.startsWith('55') ? c.telefone : `55${c.telefone}`;
              const msg = `Olá, ${c.nome.split(' ')[0]}! Aqui é da Mais Novos Imóveis. Recebemos o cadastro do seu imóvel${c.bairro ? ` no ${c.bairro}` : ''} e queremos conversar sobre a venda.`;
              return (
                <div key={c.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{c.nome}</div>
                      <div className="text-sm text-[var(--text-muted)]">
                        {tel(c.telefone)}
                        {c.email ? ` · ${c.email}` : ''} · {new Date(c.criadoEm).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <select value={c.status} onChange={(e) => mudar(c.id, e.target.value as Captacao['status'])} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm">
                      {Object.entries(STATUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 text-sm">
                    <strong>{FINALIDADE[c.finalidade] ?? c.finalidade}</strong>
                    {c.tipoUnidade ? ` · ${TIPO_UNIDADE_LABEL[c.tipoUnidade as TipoUnidade] ?? c.tipoUnidade}` : ''}
                    {c.quartos ? ` · ${c.quartos} qts` : ''}
                    {c.area ? ` · ${c.area} m²` : ''}
                    {c.valorPretendido ? ` · ${brl(c.valorPretendido)}` : ''}
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {[c.condominio, c.logradouro, c.bairro, [c.cidade, c.uf].filter(Boolean).join('/'), c.cep ? `CEP ${c.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {c.observacoes && <p className="mt-2 whitespace-pre-line text-sm">{c.observacoes}</p>}
                  <a
                    href={`https://wa.me/${num}?text=${encodeURIComponent(msg)}`}
                    target="_blank"
                    rel="noopener"
                    onClick={() => c.status === 'novo' && mudar(c.id, 'contatado')}
                    className="mt-3 inline-block rounded-full bg-[#16A34A] px-4 py-2 text-sm font-bold text-white"
                  >
                    Chamar no WhatsApp
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

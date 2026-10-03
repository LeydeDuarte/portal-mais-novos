'use client';

// Painel → Tabelas de preços: sobe tabelas de vendas em massa (PDF, Excel, CSV, ZIP ou pasta),
// lê no navegador (grátis), confere e grava com o HISTÓRICO (mês de referência de cada uma).
// O empreendimento recebe só a tabela mais recente.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { acharEmpreendimento, expandirArquivos, lerArquivoTabela, type ArquivoTabela } from '@/lib/tabelas-leitura';
import { gravarTabelas, hashesJaGravados, listarTabelas, nomesEmpreendimentos, type TabelaResumo } from '@/lib/actions-tabelas';
import type { UnidadeTabela } from '@/lib/pdf-import/parse';

type Linha = {
  chave: string;
  caminho: string;
  hash: string;
  unidades: UnidadeTabela[];
  mes: string;
  devId: string | null;
  devNome: string;
  erro?: string;
  repetida?: boolean;
  status: 'lida' | 'gravada' | 'erro';
};
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function TabelasPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [nomes, setNomes] = useState<{ id: string; nome: string }[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [gravando, setGravando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recentes, setRecentes] = useState<TabelaResumo[] | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'pendentes'>('todas');
  const parar = useRef(false);
  const inputPasta = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (!staff) return;
    nomesEmpreendimentos().then(setNomes).catch(() => {});
    listarTabelas(100).then(setRecentes).catch(() => setRecentes([]));
  }, [staff]);
  useEffect(() => {
    inputPasta.current?.setAttribute('webkitdirectory', '');
  }, []);
  const opcoes = useMemo(() => nomes.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [nomes]);
  if (!loaded || !staff) return null;
  const pode = veTudo(staff.role);

  const ler = async (arquivos: File[]) => {
    setAviso(null);
    parar.current = false;
    const lista: ArquivoTabela[] = await expandirArquivos(arquivos);
    if (!lista.length) return setAviso('Nenhum arquivo de tabela (PDF, Excel ou CSV) encontrado.');
    setProgresso({ feito: 0, total: lista.length });
    const novas: Linha[] = [];
    const lidas: Linha[] = [];
    for (let i = 0; i < lista.length; i++) {
      if (parar.current) break;
      const t = await lerArquivoTabela(lista[i]);
      const dev = acharEmpreendimento(t, nomes);
      const linha: Linha = {
        chave: `${t.hash}-${i}`,
        caminho: t.caminho,
        hash: t.hash,
        unidades: t.unidades,
        mes: t.mes ?? '',
        devId: dev?.id ?? null,
        devNome: dev?.nome ?? '',
        erro: t.erro,
        status: t.erro ? 'erro' : 'lida'
      };
      novas.push(linha);
      lidas.push(linha);
      setProgresso({ feito: i + 1, total: lista.length });
      // atualiza a tela a cada 10 arquivos (milhares de arquivos sem travar)
      if (novas.length % 10 === 0) setLinhas((l) => [...l, ...novas.splice(0)]);
    }
    setLinhas((l) => [...l, ...novas]);
    // marca as que já estão gravadas (mesmo arquivo)
    const ja = new Set(await hashesJaGravados(lidas.map((x) => x.hash)).catch(() => []));
    setLinhas((l) => l.map((x) => (ja.has(x.hash) ? { ...x, repetida: true } : x)));
    setProgresso(null);
  };

  const prontas = linhas.filter((l) => l.status === 'lida' && !l.repetida && l.unidades.length && /^\d{4}-\d{2}$/.test(l.mes));
  const gravar = async () => {
    setGravando(true);
    setAviso(null);
    let g = 0;
    let rep = 0;
    let ap = 0;
    const erros: string[] = [];
    for (let i = 0; i < prontas.length; i += 20) {
      const lote = prontas.slice(i, i + 20);
      const r = await gravarTabelas(
        lote.map((l) => ({ developmentId: l.devId, nome: l.devNome || null, mes: l.mes, arquivo: l.caminho, hash: l.hash, unidades: l.unidades.map((u) => ({ ...u, valor: u.valor ?? null, vagas: u.vagas ?? null })) }))
      ).catch((e) => ({ gravadas: 0, repetidas: 0, aplicadas: 0, erros: [e instanceof Error ? e.message : 'Falhou.'] }));
      g += r.gravadas;
      rep += r.repetidas;
      ap += r.aplicadas;
      erros.push(...r.erros);
      const feitas = new Set(lote.map((l) => l.chave));
      setLinhas((l) => l.map((x) => (feitas.has(x.chave) ? { ...x, status: 'gravada' } : x)));
    }
    setAviso(`${g} tabela(s) gravada(s) no histórico, ${ap} empreendimento(s) com preço atualizado${rep ? `, ${rep} já existia(m)` : ''}.${erros.length ? ` Avisos: ${erros.slice(0, 3).join(' ')}` : ''}`);
    setGravando(false);
    listarTabelas(100).then(setRecentes).catch(() => {});
  };

  const mostrar = filtro === 'pendentes' ? linhas.filter((l) => l.status !== 'gravada' && (l.erro || !l.devId || !l.mes || l.repetida)) : linhas;
  const semEmp = linhas.filter((l) => l.status === 'lida' && !l.devId).length;
  const semMes = linhas.filter((l) => l.status === 'lida' && !l.mes).length;

  return (
    <div className="flex min-h-screen flex-col">
      <PainelNav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 md:px-6">
        <h1 className="font-serif text-2xl font-semibold">Tabelas de preços</h1>
        <p className="text-[13px] text-[var(--text-muted)]">
          Suba tabelas de vendas de qualquer época, em qualquer ordem: cada uma fica no histórico com o seu mês. O empreendimento recebe só a mais recente. A leitura é feita no seu computador, sem custo.
        </p>

        {pode ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              ler(Array.from(e.dataTransfer.files));
            }}
            className="mt-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] p-6 text-center"
          >
            <p className="text-[14px] font-semibold">Arraste aqui PDFs, planilhas (Excel ou CSV) ou ZIPs</p>
            <div className="flex flex-wrap justify-center gap-2">
              <label className="cursor-pointer rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white">
                Escolher arquivos
                <input type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.zip" className="hidden" onChange={(e) => e.target.files && ler(Array.from(e.target.files))} />
              </label>
              <label className="cursor-pointer rounded-full border border-[var(--border)] px-4 py-2 text-[13px] font-semibold">
                Escolher uma pasta inteira
                <input ref={inputPasta} type="file" multiple className="hidden" onChange={(e) => e.target.files && ler(Array.from(e.target.files))} />
              </label>
            </div>
            {progresso && (
              <div className="w-full max-w-md">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--pill-bg)]">
                  <div className="h-full bg-accent transition-all" style={{ width: `${(progresso.feito / progresso.total) * 100}%` }} />
                </div>
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                  Lendo {progresso.feito} de {progresso.total}…{' '}
                  <button type="button" onClick={() => (parar.current = true)} className="font-semibold text-red-600">
                    Parar
                  </button>
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-[var(--pill-bg)] p-3 text-[13px]">Só admin e analista sobem tabelas. Você pode consultar as tabelas já gravadas abaixo.</p>
        )}

        {aviso && <p className="mt-3 rounded-xl bg-[#F3F7FF] px-3 py-2 text-[13px]">{aviso}</p>}

        {linhas.length > 0 && (
          <section className="mt-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-bold">Conferência ({linhas.length} arquivos)</h2>
              <span className="text-[12.5px] text-[var(--text-muted)]">
                {prontas.length} prontas{semEmp ? ` · ${semEmp} sem empreendimento` : ''}
                {semMes ? ` · ${semMes} sem mês` : ''}
              </span>
              <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="ml-auto h-9 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-[12.5px] font-semibold">
                <option value="todas">Ver todas</option>
                <option value="pendentes">Só as que precisam de atenção</option>
              </select>
              <button type="button" disabled={!prontas.length || gravando} onClick={gravar} className="h-9 rounded-full bg-accent px-4 text-[13px] font-semibold text-white disabled:opacity-40">
                {gravando ? 'Gravando…' : `Gravar ${prontas.length} tabela(s)`}
              </button>
            </div>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">Tabelas sem empreendimento também são gravadas (entram no histórico do mercado). Ligue-as depois para atualizar o preço do empreendimento.</p>
            <datalist id="lista-empreendimentos">
              {opcoes.map((o) => (
                <option key={o.id} value={o.nome} />
              ))}
            </datalist>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full min-w-[860px] text-[12.5px]">
                <thead className="bg-[var(--pill-bg)] text-left text-[11.5px] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Arquivo</th>
                    <th className="px-2 py-2 font-semibold">Empreendimento</th>
                    <th className="px-2 py-2 font-semibold">Mês</th>
                    <th className="px-2 py-2 text-right font-semibold">Unidades</th>
                    <th className="px-2 py-2 text-right font-semibold">A partir de</th>
                    <th className="px-3 py-2 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {mostrar.slice(0, 500).map((l) => {
                    const vals = l.unidades.filter((u) => u.valor && u.situacao === 'disponivel').map((u) => u.valor as number);
                    return (
                      <tr key={l.chave} className="border-t border-[var(--border)] align-top">
                        <td className="max-w-[260px] px-3 py-1.5">
                          <span className="block truncate" title={l.caminho}>
                            {l.caminho}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            list="lista-empreendimentos"
                            disabled={l.status === 'gravada'}
                            value={l.devNome}
                            onChange={(e) => {
                              const v = e.target.value;
                              const achado = nomes.find((n) => semAcento(n.nome) === semAcento(v));
                              setLinhas((ls) => ls.map((x) => (x.chave === l.chave ? { ...x, devNome: v, devId: achado?.id ?? null } : x)));
                            }}
                            placeholder="Escolha o empreendimento"
                            className={`h-8 w-56 rounded-lg border bg-[var(--bg)] px-2 text-[12.5px] ${l.devId ? 'border-[var(--border)]' : 'border-[#E08A00]'}`}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="month"
                            disabled={l.status === 'gravada'}
                            value={l.mes}
                            onChange={(e) => setLinhas((ls) => ls.map((x) => (x.chave === l.chave ? { ...x, mes: e.target.value } : x)))}
                            className={`h-8 rounded-lg border bg-[var(--bg)] px-2 text-[12.5px] ${l.mes ? 'border-[var(--border)]' : 'border-[#E08A00]'}`}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{l.unidades.length}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{vals.length ? brl(Math.min(...vals)) : '-'}</td>
                        <td className="px-3 py-1.5">
                          {l.status === 'gravada' ? (
                            <span className="font-semibold text-[#13874B]">Gravada</span>
                          ) : l.repetida ? (
                            <span className="text-[var(--text-muted)]">Já estava gravada</span>
                          ) : l.erro ? (
                            <span className="text-red-600">{l.erro}</span>
                          ) : !l.mes ? (
                            <span className="text-[#B45F06]">Falta o mês</span>
                          ) : !l.devId ? (
                            <span className="text-[#B45F06]">Sem empreendimento (vai só para o histórico)</span>
                          ) : (
                            <span>Pronta</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {mostrar.length > 500 && <p className="mt-1 text-[12px] text-[var(--text-muted)]">Mostrando 500 de {mostrar.length}. Todas são gravadas.</p>}
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-[15px] font-bold">Últimas tabelas gravadas</h2>
          {!recentes ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : recentes.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhuma ainda.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead className="bg-[var(--pill-bg)] text-left text-[11.5px] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Empreendimento</th>
                    <th className="px-2 py-2 font-semibold">Mês</th>
                    <th className="px-2 py-2 text-right font-semibold">Unidades</th>
                    <th className="px-2 py-2 text-right font-semibold">A partir de</th>
                    <th className="px-3 py-2 text-right font-semibold">m² médio</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((t) => (
                    <tr key={t.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-1.5">{t.empreendimento ?? <span className="text-[#B45F06]">sem empreendimento</span>}</td>
                      <td className="px-2 py-1.5">{t.mes.split('-').reverse().join('/')}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {t.disponiveis}/{t.unidades}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t.valorMin ? brl(t.valorMin) : '-'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{t.m2 ? brl(t.m2) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

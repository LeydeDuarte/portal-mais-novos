'use client';

// Painel → Tabelas de preços: sobe tabelas de vendas em massa (PDF, Excel, CSV, ZIP ou pasta),
// lê no navegador (grátis), confere e grava com o HISTÓRICO (mês de referência de cada uma).
// O empreendimento recebe só a tabela mais recente.
import { fluxoEmTexto, type PagamentoTabela } from '@/lib/tabelas-pagamento';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { acharEmpreendimento, expandirArquivos, lerArquivoTabela, type ArquivoTabela } from '@/lib/tabelas-leitura';
import { acompanharTabela, condominiosParaAtualizar, gravarTabelas, nomesIncorporadoras, hashesJaGravados, type CondoParaAtualizar, listarTabelas, nomesEmpreendimentos, recalcularDisponibilidade, unidadesDaTabela, type TabelaResumo, type UnidadeSalva } from '@/lib/actions-tabelas';
import type { UnidadeTabela } from '@/lib/pdf-import/parse';

type Linha = {
  chave: string;
  caminho: string;
  hash: string;
  unidades: UnidadeTabela[];
  pagamento?: PagamentoTabela | null;
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
  // tipo do lote: tabela de lançamento (por empreendimento) ou estoque de revenda (por incorporadora)
  const [tipo, setTipo] = useState<'lancamento' | 'revenda'>('lancamento');
  const [empresaId, setEmpresaId] = useState('');
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [paraAtualizar, setParaAtualizar] = useState<CondoParaAtualizar[] | null>(null);
  const [aberta, setAberta] = useState<{ id: string; unidades: UnidadeSalva[] | null } | null>(null);
  const parar = useRef(false);
  const inputPasta = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (!staff) return;
    nomesEmpreendimentos().then(setNomes).catch(() => {});
    listarTabelas(100).then(setRecentes).catch(() => setRecentes([]));
    condominiosParaAtualizar().then(setParaAtualizar).catch(() => setParaAtualizar([]));
    nomesIncorporadoras().then(setEmpresas).catch(() => {});
  }, [staff]);
  useEffect(() => {
    inputPasta.current?.setAttribute('webkitdirectory', '');
  }, []);
  const opcoes = useMemo(() => nomes.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [nomes]);
  // sair da página com tabelas conferidas e não gravadas: o navegador pergunta antes
  const naoGravadas = linhas.filter((l) => l.status === 'lida' && !l.repetida && l.unidades.length).length;
  useEffect(() => {
    if (!naoGravadas) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [naoGravadas]);
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
        pagamento: t.pagamento ?? null,
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

  const prontas = linhas.filter((l) => l.status === 'lida' && !l.repetida && l.unidades.length && /^\d{4}-\d{2}$/.test(l.mes) && (tipo === 'lancamento' || !!empresaId));
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
        lote.map((l) => ({ tipo, empresaId: tipo === 'revenda' ? empresaId : null, developmentId: tipo === 'revenda' ? null : l.devId, nome: tipo === 'revenda' ? empresas.find((e) => e.id === empresaId)?.nome ?? null : l.devNome || null, mes: l.mes, arquivo: l.caminho, hash: l.hash, pagamento: l.pagamento ?? null, unidades: l.unidades.map((u) => ({ ...u, valor: u.valor ?? null, vagas: u.vagas ?? null })) }))
      ).catch((e) => ({ gravadas: 0, repetidas: 0, aplicadas: 0, erros: [e instanceof Error ? e.message : 'Falhou.'], porHash: {} as Record<string, string> }));
      g += r.gravadas;
      rep += r.repetidas;
      ap += r.aplicadas;
      erros.push(...r.erros);
      const doLote = new Set(lote.map((l) => l.chave));
      setLinhas((l) =>
        l.map((x) => {
          if (!doLote.has(x.chave)) return x;
          const st = r.porHash[x.hash];
          if (st === 'gravada') return { ...x, status: 'gravada' };
          if (st === 'repetida') return { ...x, repetida: true };
          return { ...x, status: 'erro', erro: st || r.erros[0] || 'Não foi gravada. Tente de novo.' };
        })
      );
    }
    setAviso(
      g
        ? `Pronto: ${g} tabela(s) gravada(s). ${ap} empreendimento(s) ligado(s) tiveram as unidades disponíveis atualizadas${g > ap ? ` (as demais estão sem empreendimento ou não são a tabela mais recente)` : ''}${rep ? `; ${rep} já tinha(m) sido gravada(s) antes` : ''}.${erros.length ? ` Atenção: ${erros.slice(0, 3).join(' ')}` : ''}`
        : `Nenhuma tabela foi gravada.${rep ? ` ${rep} já tinha(m) sido gravada(s) antes.` : ''}${erros.length ? ` Motivo: ${erros.slice(0, 3).join(' ')}` : ''}`
    );
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

        {pode && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(
              [
                ['lancamento', 'Tabela de lançamento (por empreendimento)'],
                ['revenda', 'Estoque de revenda (por incorporadora)']
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" disabled={linhas.length > 0} onClick={() => setTipo(v)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-60 ${tipo === v ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}>
                {l}
              </button>
            ))}
            {tipo === 'revenda' && (
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={`h-9 rounded-full border bg-[var(--bg)] px-3 text-[13px] font-semibold ${empresaId ? 'border-[var(--border)]' : 'border-[#E08A00]'}`}>
                <option value="">Escolha a incorporadora…</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            )}
            {tipo === 'revenda' && (
              <p className="basis-full text-[12px] text-[var(--text-muted)]">
                Planilha mensal de estoque de revenda (permutas) da incorporadora: uma linha por unidade, com o empreendimento, a unidade, a metragem e o valor. Cada linha é ligada ao condomínio de mesmo nome. Para trocar o tipo, grave ou limpe a lista abaixo.
              </p>
            )}
          </div>
        )}
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
            <p className="max-w-xl text-[12px] text-[var(--text-muted)]">
              O PDF da incorporadora pode vir como está: a leitura reconhece a unidade, a área privativa e o valor total sozinha. Para ligar sem erro, nomeie o arquivo com o{' '}
              <strong>nome do empreendimento e o mês</strong> (ex.: &quot;Elements - set 2026.pdf&quot;). Tabela escaneada (foto) não é lida: peça o PDF original ou use o{' '}
              <a href="/modelos/modelo-tabela-de-precos.csv" download className="font-semibold text-accent underline">
                modelo padrão de planilha
              </a>
              .
            </p>
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

        {prontas.length > 0 && !gravando && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-accent bg-[#F3F7FF] px-4 py-3">
            <span className="text-[14px] font-semibold">
              {prontas.length} tabela(s) conferida(s). Falta <strong>gravar</strong> para entrarem no sistema.
            </span>
            <button type="button" onClick={gravar} className="h-10 rounded-full bg-accent px-5 text-[14px] font-bold text-white">
              Gravar {prontas.length} tabela(s)
            </button>
          </div>
        )}
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
                          {l.pagamento?.fluxo ? (
                            <span className="mt-0.5 block text-[11px] leading-snug text-[#13874B]" title={l.pagamento.texto}>
                              Pagamento: {fluxoEmTexto(l.pagamento.fluxo)}
                            </span>
                          ) : l.pagamento?.texto ? (
                            <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]" title={l.pagamento.texto}>
                              Forma de pagamento guardada como texto (passe o mouse para ver)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5">
                          {tipo === 'revenda' ? (
                            <span className={empresaId ? 'font-semibold' : 'text-[#B45F06]'}>{empresas.find((e) => e.id === empresaId)?.nome ?? 'Escolha a incorporadora'}</span>
                          ) : (
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
                          )}
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
                          ) : tipo === 'revenda' && !empresaId ? (
                            <span className="text-[#B45F06]">Escolha a incorporadora</span>
                          ) : tipo === 'lancamento' && !l.devId ? (
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

        {paraAtualizar && paraAtualizar.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[15px] font-bold">Para atualizar ({paraAtualizar.length})</h2>
            <p className="text-[12px] text-[var(--text-muted)]">
              Lançamento, obras e pronto novo com a última tabela de mais de 3 meses: as unidades disponíveis não aparecem mais no site. Suba a tabela nova ou, se não houver mais, pare de acompanhar.
            </p>
            <div className="mt-2 overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full min-w-[620px] text-[12.5px]">
                <thead className="bg-[var(--pill-bg)] text-left text-[11.5px] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Empreendimento</th>
                    <th className="px-2 py-2 font-semibold">Última tabela</th>
                    <th className="px-2 py-2 text-right font-semibold">Disponíveis nela</th>
                    <th className="px-2 py-2 font-semibold">Entrega</th>
                    <th className="px-3 py-2 text-right font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {paraAtualizar.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-1.5">
                        <span className="font-semibold">{c.nome}</span>
                        {c.bairro && <span className="text-[var(--text-muted)]"> · {c.bairro}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-[#B45F06]">{c.ultimaTabela.split('-').reverse().join('/')}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{c.disponiveis ?? '-'}</td>
                      <td className="px-2 py-1.5">{c.entrega ? c.entrega.split('-').reverse().join('/') : '-'}</td>
                      <td className="px-3 py-1.5 text-right">
                        {pode && (
                          <span className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await acompanharTabela(c.id, false, 'Esgotado (100% vendido)');
                                setParaAtualizar((l) => l?.filter((x) => x.id !== c.id) ?? l);
                              }}
                              className="rounded-full bg-[var(--pill-bg)] px-2.5 py-1 font-semibold hover:bg-[var(--pill-bg-hover)]"
                            >
                              Esgotado
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const m = window.prompt('Motivo para parar de acompanhar:', 'A incorporadora não envia mais');
                                if (m === null) return;
                                await acompanharTabela(c.id, false, m);
                                setParaAtualizar((l) => l?.filter((x) => x.id !== c.id) ?? l);
                              }}
                              className="rounded-full bg-[var(--pill-bg)] px-2.5 py-1 font-semibold hover:bg-[var(--pill-bg-hover)]"
                            >
                              Parar de acompanhar
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">Últimas tabelas gravadas</h2>
            {pode && (
              <button
                type="button"
                disabled={gravando}
                onClick={async () => {
                  if (!recentes?.length) {
                    setAviso('Ainda não há nenhuma tabela gravada. Suba os arquivos acima e clique em "Gravar" primeiro; este botão só recalcula a partir das tabelas já gravadas.');
                    return;
                  }
                  setGravando(true);
                  const n = await recalcularDisponibilidade().catch(() => 0);
                  setGravando(false);
                  setAviso(`Unidades disponíveis recalculadas em ${n} empreendimento(s), a partir das tabelas já gravadas.`);
                }}
                className="h-9 rounded-full border border-[var(--border)] px-4 text-[12.5px] font-semibold disabled:opacity-40"
              >
                Recalcular as unidades disponíveis (tabelas já gravadas)
              </button>
            )}
          </div>
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
                    <th className="px-2 py-2 text-right font-semibold">Disp./unidades</th>
                    <th className="px-2 py-2 text-right font-semibold">Metragens</th>
                    <th className="px-2 py-2 text-right font-semibold">A partir de</th>
                    <th className="px-3 py-2 text-right font-semibold">m² médio</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((t) => (
                    <Fragment key={t.id}>
                    <tr className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--pill-bg)]" onClick={() => {
                      if (aberta?.id === t.id) return setAberta(null);
                      setAberta({ id: t.id, unidades: null });
                      unidadesDaTabela(t.id).then((u) => setAberta((a) => (a?.id === t.id ? { id: t.id, unidades: u } : a))).catch(() => {});
                    }}>
                      <td className="px-3 py-1.5">
                        <span className="mr-1 text-[var(--text-muted)]">{aberta?.id === t.id ? '▾' : '▸'}</span>
                        {t.empreendimento ?? <span className="text-[#B45F06]">sem empreendimento</span>}
                      </td>
                      <td className="px-2 py-1.5">{t.mes.split('-').reverse().join('/')}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {t.disponiveis}/{t.unidades}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {t.areaMin ? `${Math.round(t.areaMin)}${t.areaMax && Math.round(t.areaMax) !== Math.round(t.areaMin) ? ` a ${Math.round(t.areaMax)}` : ''} m²` : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t.valorMin ? brl(t.valorMin) : '-'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{t.m2 ? brl(t.m2) : '-'}</td>
                    </tr>
                    {aberta?.id === t.id && (
                      <tr className="bg-[var(--pill-bg)]/50">
                        <td colSpan={6} className="px-3 py-2">
                          {!aberta.unidades ? (
                            <span className="text-[12px] text-[var(--text-muted)]">Carregando unidades…</span>
                          ) : (
                            <div className="max-h-80 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                              <table className="w-full text-[12px]">
                                <thead className="sticky top-0 bg-[var(--bg)] text-left text-[11px] text-[var(--text-muted)]">
                                  <tr>
                                    <th className="px-2 py-1.5">Unidade</th>
                                    <th className="px-2 py-1.5">Torre</th>
                                    <th className="px-2 py-1.5 text-right">m²</th>
                                    <th className="px-2 py-1.5 text-right">Vagas</th>
                                    <th className="px-2 py-1.5">Garagens</th>
                                    <th className="px-2 py-1.5">Escaninho</th>
                                    <th className="px-2 py-1.5 text-right">Valor</th>
                                    <th className="px-2 py-1.5">Situação</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {aberta.unidades.map((u, i) => (
                                    <tr key={i} className="border-t border-[var(--border)] tabular-nums">
                                      <td className="px-2 py-1 font-semibold">{u.unidade}</td>
                                      <td className="px-2 py-1">{u.torre ?? '-'}</td>
                                      <td className="px-2 py-1 text-right">{u.area?.toLocaleString('pt-BR') ?? '-'}</td>
                                      <td className="px-2 py-1 text-right">{u.vagas ?? '-'}</td>
                                      <td className="px-2 py-1">{u.garagens ?? '-'}</td>
                                      <td className="px-2 py-1">{u.escaninho ?? '-'}</td>
                                      <td className="px-2 py-1 text-right">{u.valor ? brl(u.valor) : '-'}</td>
                                      <td className={`px-2 py-1 ${u.situacao === 'disponivel' ? 'text-[#13874B]' : 'text-[var(--text-muted)]'}`}>{u.situacao === 'disponivel' ? 'Disponível' : u.situacao === 'vendida' ? 'Vendida' : u.situacao === 'reservada' ? 'Reservada' : u.situacao ?? '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
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

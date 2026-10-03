'use client';

import TemporadaBadge, { SinoRecepcao } from '@/components/TemporadaBadge';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { contarDuplicados, juntarCondominios } from '@/lib/duplicados';
import { compartilharCondominio, excluirCondominio, listarCondominiosPainel, marcarTemporadaCondominio, type CondoPainel } from '@/lib/actions-painel-condominios';
import { marcarDestaqueFeed } from '@/lib/actions';
import { BUCKET_LABEL, FASES, getStatusBucket, type StatusBucket } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { BarraSelecao, BuscaGrande, Chips, marcados, FiltrosAtivos, MenuAcoes, SecaoFiltro, TituloPainel, Vazio, botaoBarra, campoPainel } from '@/components/painel/ui';
import { paraBusca } from '@/lib/busca-texto';
import { tabelaVigente } from '@/lib/disponibilidade';
import { acompanharTabela, marcarVendido100 } from '@/lib/actions-tabelas';

// busca tolerante: acentos, y/i, w/v, ph/f, letras dobradas (lib/busca-texto.ts)
const sa = paraBusca;
/** situação da tabela de vendas: em dia, desatualizada, sem tabela ou não acompanhar */
const situacaoTabela = (c: CondoPainel): 'em_dia' | 'desatualizada' | 'sem_tabela' | 'nao_acompanha' | 'vendido' =>
  c.vendido100 ? 'vendido' : !c.tabelaAcompanhar ? 'nao_acompanha' : !c.tabelaReferencia ? 'sem_tabela' : tabelaVigente(c.tabelaReferencia) ? 'em_dia' : 'desatualizada';
const TABELA_LABEL: Record<string, string> = { em_dia: 'Em dia', desatualizada: 'Desatualizada', sem_tabela: 'Sem tabela', nao_acompanha: 'Não acompanhar', vendido: '100% vendido' };
const campo = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-accent';
const rotulo = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]';
const brl = (v: number | null) => (v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);
const POR_PAGINA = 60;
const COR: Record<StatusBucket, string> = {
  breve_lancamento: '#6A3CFF',
  lancamento: '#257CFF',
  obras: '#E08A00',
  novo: '#1B5FCC',
  seminovo: '#5B6B7A',
  usado: '#3c4043',
  antigo: '#75787e'
};

type Filtros = { nome: string; uf: string; cidade: string; bairro: string; empresa: string; anoDe: string; anoAte: string; data: string; status: string; fase: string; tipo: string; temporada: string; tabela: string };
const VAZIO: Filtros = { nome: '', uf: '', cidade: '', bairro: '', empresa: '', anoDe: '', anoAte: '', data: '', status: '', fase: '', tipo: '', temporada: '', tabela: '' };

// "Mais informações" = mais fotos, texto, data e anúncios (o principal ao unificar)
const pontos = (c: CondoPainel) => c.fotos * 3 + Math.min(c.descricao, 2000) / 100 + (c.entrega ? 5 : 0) + c.anuncios * 4 + c.empresas.length * 2;

export default function CondominiosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [itens, setItens] = useState<CondoPainel[] | null>(null);
  const [f, setF] = useState<Filtros>(VAZIO);
  const [pagina, setPagina] = useState(1);
  const [duplicados, setDuplicados] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtrosCel, setFiltrosCel] = useState(false);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () => listarCondominiosPainel().then(setItens).catch(() => setItens([]));
  useEffect(() => {
    if (!staff) return;
    carregar();
    if (veTudo(staff.role)) contarDuplicados().then(setDuplicados).catch(() => {});
  }, [staff]);
  useEffect(() => setPagina(1), [f]);

  const comFase = useMemo(() => (itens ?? []).map((c) => ({ c, fase: c.entrega ? getStatusBucket(c.entrega) : null })), [itens]);
  const opcoes = useMemo(() => {
    const u = (v: (string | null)[]) => Array.from(new Set(v.filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const base = itens ?? [];
    return {
      ufs: u(base.map((c) => c.uf)),
      cidades: u(base.filter((c) => !f.uf || c.uf === f.uf).map((c) => c.cidade)),
      bairros: u(base.filter((c) => (!f.uf || c.uf === f.uf) && (!f.cidade || c.cidade === f.cidade)).map((c) => c.bairro)),
      empresas: u(base.flatMap((c) => c.empresas))
    };
  }, [itens, f.uf, f.cidade]);

  const filtrados = useMemo(() => {
    const nome = sa(f.nome.trim());
    return comFase.filter(({ c, fase }) => {
      const ano = c.entrega ? Number(c.entrega.slice(0, 4)) : null;
      if (nome && !sa(`${c.nome} ${c.bairro ?? ''} ${c.empresas.join(' ')}`).includes(nome)) return false;
      if (f.uf && c.uf !== f.uf) return false;
      if (f.cidade && c.cidade !== f.cidade) return false;
      if (f.bairro && c.bairro !== f.bairro) return false;
      if (f.empresa && (f.empresa === '__sem__' ? c.empresas.length > 0 : !c.empresas.includes(f.empresa))) return false;
      const datas = marcados(f.data);
      if (datas.length === 1 && datas[0] === 'com' && !c.entrega) return false;
      if (datas.length === 1 && datas[0] === 'sem' && c.entrega) return false;
      if (f.anoDe && (!ano || ano < Number(f.anoDe))) return false;
      if (f.anoAte && (!ano || ano > Number(f.anoAte))) return false;
      if (f.status && !marcados(f.status).includes(c.status)) return false;
      if (f.tipo && !marcados(f.tipo).includes(c.tipo)) return false;
      if (f.fase && !marcados(f.fase).includes(fase as string)) return false;
      if (f.temporada && !marcados(f.temporada).includes(c.aceitaTemporada ? 'sim' : 'nao')) return false;
      if (f.tabela && !marcados(f.tabela).includes(situacaoTabela(c))) return false;
      return true;
    });
  }, [comFase, f]);

  // contador por fase (sobre os filtros atuais, sem o filtro de fase)
  const contagem = useMemo(() => {
    const m: Partial<Record<StatusBucket, number>> = {};
    const semFase = { ...f, fase: '' };
    const nome = sa(semFase.nome.trim());
    for (const { c, fase } of comFase) {
      if (!fase) continue;
      if (nome && !sa(`${c.nome} ${c.bairro ?? ''} ${c.empresas.join(' ')}`).includes(nome)) continue;
      if ((f.uf && c.uf !== f.uf) || (f.cidade && c.cidade !== f.cidade) || (f.bairro && c.bairro !== f.bairro) || (f.empresa && (f.empresa === '__sem__' ? c.empresas.length > 0 : !c.empresas.includes(f.empresa)))) continue;
      m[fase] = (m[fase] ?? 0) + 1;
    }
    return m;
  }, [comFase, f]);

  if (!loaded || !staff) return null;
  const gestor = veTudo(staff.role);
  const set = (k: keyof Filtros, v: string) => setF((x) => ({ ...x, [k]: v, ...(k === 'uf' ? { cidade: '', bairro: '' } : k === 'cidade' ? { bairro: '' } : {}) }));
  const ativos = Object.values(f).filter(Boolean).length;
  const pagina0 = filtrados.slice(0, pagina * POR_PAGINA);

  const Filtro = (
    <div className="flex flex-col gap-6">
      <SecaoFiltro titulo="Fase">
        <Chips opcoes={FASES.map((x) => ({ v: x as string, l: BUCKET_LABEL[x], n: contagem[x] ?? 0 }))} valor={f.fase} onChange={(v) => set('fase', v)} multi />
      </SecaoFiltro>
      <SecaoFiltro titulo="Data de entrega">
        <Chips opcoes={[{ v: 'com', l: 'Com data' }, { v: 'sem', l: 'Sem data' }]} valor={f.data} onChange={(v) => set('data', v)} multi />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input className={campoPainel} inputMode="numeric" placeholder="ano de" value={f.anoDe} onChange={(e) => set('anoDe', e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <input className={campoPainel} inputMode="numeric" placeholder="até" value={f.anoAte} onChange={(e) => set('anoAte', e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
      </SecaoFiltro>
      <SecaoFiltro titulo="Tipo">
        <Chips opcoes={[{ v: 'vertical', l: 'Vertical' }, { v: 'horizontal', l: 'Horizontal' }]} valor={f.tipo} onChange={(v) => set('tipo', v)} multi />
      </SecaoFiltro>
      <SecaoFiltro titulo="Cadastro">
        <Chips opcoes={[{ v: 'publicado', l: 'Publicados' }, { v: 'rascunho', l: 'Rascunhos' }]} valor={f.status} onChange={(v) => set('status', v)} multi />
      </SecaoFiltro>
      <SecaoFiltro titulo="Localização">
        <div className="flex flex-col gap-2">
          <select className={campoPainel} value={f.uf} onChange={(e) => set('uf', e.target.value)}>
            <option value="">Todos os estados</option>
            {opcoes.ufs.map((u) => (<option key={u}>{u}</option>))}
          </select>
          <select className={campoPainel} value={f.cidade} onChange={(e) => set('cidade', e.target.value)}>
            <option value="">Todas as cidades</option>
            {opcoes.cidades.map((c) => (<option key={c}>{c}</option>))}
          </select>
          <select className={campoPainel} value={f.bairro} onChange={(e) => set('bairro', e.target.value)}>
            <option value="">Todos os bairros</option>
            {opcoes.bairros.map((b) => (<option key={b}>{b}</option>))}
          </select>
        </div>
      </SecaoFiltro>
      <SecaoFiltro titulo={<span className="flex items-center gap-1.5"><span className="text-[#FF385C]"><SinoRecepcao size={13} /></span>Temporada</span>}>
        <Chips opcoes={[{ v: 'sim', l: 'Aceita' }, { v: 'nao', l: 'Não marcado' }]} valor={f.temporada} onChange={(v) => set('temporada', v)} multi />
      </SecaoFiltro>
      <SecaoFiltro titulo="Tabela de vendas">
        <Chips
          opcoes={(['em_dia', 'desatualizada', 'sem_tabela', 'vendido', 'nao_acompanha'] as const).map((v) => ({ v, l: TABELA_LABEL[v], n: (itens ?? []).filter((c) => situacaoTabela(c) === v).length }))}
          valor={f.tabela}
          onChange={(v) => set('tabela', v)}
          multi
        />
        <p className="mt-1 text-[11px] text-[var(--text-faint)]">Desatualizada: a última tabela tem mais de 3 meses (as unidades não aparecem mais no site).</p>
      </SecaoFiltro>
      <SecaoFiltro titulo="Construtora / incorporadora">
        <select className={campoPainel} value={f.empresa} onChange={(e) => set('empresa', e.target.value)}>
          <option value="">Todas</option>
          <option value="__sem__">Sem incorporadora ligada</option>
          {opcoes.empresas.map((b) => (<option key={b}>{b}</option>))}
        </select>
      </SecaoFiltro>
    </div>
  );

  const ativosLista = [
    f.fase && { rotulo: marcados(f.fase).map((x) => BUCKET_LABEL[x as StatusBucket] ?? x).join(', '), tirar: () => set('fase', '') },
    f.data && { rotulo: marcados(f.data).map((x) => (x === 'com' ? 'Com data' : 'Sem data')).join(', '), tirar: () => set('data', '') },
    (f.anoDe || f.anoAte) && { rotulo: `Entrega ${f.anoDe || '…'}–${f.anoAte || '…'}`, tirar: () => setF((x) => ({ ...x, anoDe: '', anoAte: '' })) },
    f.tipo && { rotulo: marcados(f.tipo).map((x) => (x === 'vertical' ? 'Vertical' : 'Horizontal')).join(', '), tirar: () => set('tipo', '') },
    f.tabela && { rotulo: `Tabela: ${marcados(f.tabela).map((x) => TABELA_LABEL[x] ?? x).join(', ')}`, tirar: () => set('tabela', '') },
    f.temporada && { rotulo: `Temporada: ${marcados(f.temporada).map((x) => (x === 'sim' ? 'Aceita' : 'Não marcado')).join(', ')}`, tirar: () => set('temporada', '') },
    f.status && { rotulo: marcados(f.status).map((x) => (x === 'publicado' ? 'Publicados' : 'Rascunhos')).join(', '), tirar: () => set('status', '') },
    f.uf && { rotulo: f.uf, tirar: () => set('uf', '') },
    f.cidade && { rotulo: f.cidade, tirar: () => set('cidade', '') },
    f.bairro && { rotulo: f.bairro, tirar: () => set('bairro', '') },
    f.empresa && { rotulo: f.empresa === '__sem__' ? 'Sem incorporadora' : f.empresa, tirar: () => set('empresa', '') }
  ].filter(Boolean) as { rotulo: string; tirar: () => void }[];

  const unificar = async () => {
    const escolhidos = (itens ?? []).filter((c) => sel.includes(c.id)).sort((a, b) => pontos(b) - pontos(a));
    if (escolhidos.length < 2) return;
    const [principal, ...outros] = escolhidos;
    if (
      !window.confirm(
        `Unificar ${escolhidos.length} condomínios?\n\nFica: ${principal.nome} (${principal.bairro ?? ''}), que tem mais informações.\nOs outros só completam o que estiver vazio, e anúncios, interessados e histórico passam para ele. Os endereços antigos redirecionam.`
      )
    )
      return;
    const r = await juntarCondominios(principal.id, outros.map((o) => o.id));
    if (!r.ok) return setAviso(r.erro ?? 'Não foi possível unificar.');
    setSel([]);
    setAviso(`Unificado em ${principal.nome}.`);
    carregar();
  };

  return (
    <div className="min-h-screen">
      <PainelNav />
      <div className="mx-auto max-w-[1680px] px-4 pb-24 pt-6 md:px-6 md:pt-8">
        <div className="flex flex-col gap-5">
          <TituloPainel
            titulo="Condomínios"
            contagem={itens ? (<><strong className="text-[var(--text)]">{filtrados.length}</strong> de {itens.length} condomínios</>) : 'Carregando…'}
          >
            <button type="button" onClick={() => setFiltrosCel(true)} className="h-11 rounded-full bg-[var(--pill-bg)] px-4 text-[13px] font-semibold md:hidden">
              Filtros{ativosLista.length ? ` (${ativosLista.length})` : ''}
            </button>
            {gestor && (
              <Link href="/dashboard/condominios/duplicados" className="flex h-11 items-center rounded-full bg-[var(--pill-bg)] px-4 text-[13px] font-semibold hover:bg-[var(--pill-bg-hover)]">
                {duplicados ? `${duplicados} possíveis duplicados` : 'Duplicados'}
              </Link>
            )}
            {gestor && (
              <Link href="/dashboard/condominios/importar" className="flex h-11 items-center rounded-full bg-[var(--pill-bg)] px-4 text-[13px] font-semibold hover:bg-[var(--pill-bg-hover)]">
                Importar planilha
              </Link>
            )}
            {gestor && (
              <Link href="/dashboard/imoveis/novo" className="flex h-11 items-center rounded-full bg-ink px-5 text-[14px] font-semibold text-white hover:opacity-90">
                + Novo condomínio
              </Link>
            )}
          </TituloPainel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['breve_lancamento', 'lancamento', 'obras', 'novo'] as StatusBucket[]).map((fs) => {
              const fases = marcados(f.fase);
              const on = fases.includes(fs);
              return (
                <button
                  key={fs}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('fase', (on ? fases.filter((x) => x !== fs) : [...fases, fs]).join(','))}
                  className={`rounded-[20px] border p-4 text-left transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] ${on ? 'border-transparent text-white' : 'border-[var(--border)]'}`}
                  style={on ? { background: COR[fs] } : undefined}
                >
                  <div className="text-[28px] font-bold leading-none tabular-nums" style={on ? undefined : { color: COR[fs] }}>{contagem[fs] ?? 0}</div>
                  <div className="mt-1.5 text-[13px] font-semibold">{BUCKET_LABEL[fs]}</div>
                </button>
              );
            })}
          </div>
          <BuscaGrande value={f.nome} onChange={(v) => set('nome', v)} placeholder="Buscar pelo nome, bairro ou construtora" />
          <FiltrosAtivos itens={ativosLista} onLimpar={() => setF(VAZIO)} />
          {aviso && (
            <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" onClick={() => setAviso(null)}>
              {aviso}
            </p>
          )}
        </div>
        <div className="mt-6 flex gap-6">
          <aside className="hidden w-[250px] shrink-0 md:block">
            <div className="sticky top-[132px] max-h-[calc(100vh-150px)] overflow-y-auto pr-2 [scrollbar-width:thin]">{Filtro}</div>
          </aside>
          <main className="min-w-0 flex-1">
          {itens && filtrados.length === 0 && <Vazio titulo="Nenhum condomínio encontrado" texto="Tente ajustar a busca ou os filtros." />}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {pagina0.map(({ c, fase }) => {
              const marcado = sel.includes(c.id);
              return (
                <div
                  key={c.id}
                  className={`group flex flex-col overflow-hidden rounded-[20px] bg-[var(--bg)] text-[12.5px] transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${
                    marcado ? 'border border-ink ring-1 ring-ink' : c.destaque ? 'border-2 border-[#257CFF]' : 'border border-[var(--border)]'
                  } ${c.temVideo && !marcado ? 'ring-4 ring-sky-200 dark:ring-sky-900' : ''}`}
                >
                  <a href={`/empreendimento/${c.slug ?? c.id}`} className="block">
                    <div className="relative aspect-[16/10] bg-[var(--card-img-bg)]">
                      {c.capa ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.capa} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] text-[var(--text-faint)]">sem foto</div>
                      )}
                      <div className="absolute left-1.5 top-1.5 flex gap-1">
                        {fase && (
                          <span className="rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white" style={{ background: COR[fase] }}>
                            {BUCKET_LABEL[fase]}
                            {c.entrega ? ` · ${c.entrega.slice(0, 4)}` : ''}
                          </span>
                        )}
                        {!c.entrega && <span className="rounded bg-black/55 px-1.5 py-0.5 text-[9.5px] font-bold text-white">SEM DATA</span>}
                        {c.status === 'rascunho' && <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[9.5px] font-bold text-white">RASCUNHO</span>}
                        {c.destaque && <span className="rounded bg-accent px-1.5 py-0.5 text-[9.5px] font-bold text-white">★ {c.destaqueTamanho === 3 ? '2×2' : '2 COL.'}</span>}
                        {c.temVideo && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-800">▶ VÍDEO</span>}
                        {c.aceitaTemporada && <TemporadaBadge compacto />}
                      </div>
                      <div className="absolute bottom-1.5 right-1.5 flex gap-1 text-[10px] font-bold text-white">
                        <span className="rounded bg-black/55 px-1.5 py-0.5" title="Visualizações">👁 {c.visualizacoes}</span>
                        <span className="rounded bg-black/55 px-1.5 py-0.5" title="Salvamentos">♥ {c.salvamentos}</span>
                        <span className="rounded bg-black/55 px-1.5 py-0.5" title="Compartilhamentos">↗ {c.compartilhamentos}</span>
                      </div>
                    </div>
                    <div className="px-2.5 pt-2">
                      <div className="truncate font-bold">{c.nome}</div>
                      <div className="truncate text-[var(--text-muted)]">{[c.bairro, c.cidade].filter(Boolean).join(', ')}</div>
                      {c.tipologias.length > 0 && (
                        <div className="truncate text-[11px] text-accent">{c.tipologias.map((t) => TIPO_UNIDADE_LABEL[t as TipoUnidade] ?? t).join(' · ')}</div>
                      )}
                      {c.empresas.length > 0 && <div className="truncate text-[11px] text-[var(--text-faint)]">{c.empresas.join(' · ')}</div>}
                      <div className="mt-1 flex flex-wrap gap-x-2 text-[11px]">
                        <span className={c.anuncios ? 'font-bold text-[#16A34A]' : 'text-[var(--text-faint)]'}>{c.anuncios} anúncio(s)</span>
                        {c.vendido100 ? (
                          <span className="font-bold text-[#E62F2F]">100% vendido</span>
                        ) : !c.tabelaAcompanhar && c.tabelaReferencia ? (
                          <span className="text-[var(--text-faint)]" title={c.tabelaMotivo ?? undefined}>
                            Tabela: não acompanhar{c.tabelaMotivo ? ` (${c.tabelaMotivo.replace(/ \(por .*\)$/, '')})` : ''}
                          </span>
                        ) : c.disponiveis ? (
                          tabelaVigente(c.tabelaReferencia) ? (
                            <span className={`font-bold ${c.disponiveis < 10 ? 'text-[#C81E1E]' : 'text-[#1B5FCC]'}`} title={c.tabelaReferencia ? `Tabela de ${c.tabelaReferencia.split('-').reverse().join('/')}` : undefined}>
                              {c.disponiveis} disponíve{c.disponiveis === 1 ? 'l' : 'is'} na tabela
                            </span>
                          ) : (
                            <span className="text-[var(--text-faint)]" title="Não aparece no site: suba uma tabela nova">
                              {c.disponiveis} na tabela antiga{c.tabelaReferencia ? ` (${c.tabelaReferencia.split('-').reverse().join('/')})` : ''}
                            </span>
                          )
                        ) : null}
                        {c.m2Medio ? <span className="text-[var(--text-muted)]">{brl(c.m2Medio)}/m²</span> : null}
                        {c.aPartirDe ? <span className="text-[var(--text-muted)]">a partir de {brl(c.aPartirDe)}</span> : null}
                      </div>
                    </div>
                  </a>
                  <div className="mt-auto flex items-center gap-1.5 px-3 pb-3 pt-2.5">
                    <label className="grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-[var(--pill-bg)]" title="Selecionar para unificar">
                      <input type="checkbox" checked={marcado} onChange={() => setSel((s) => (marcado ? s.filter((x) => x !== c.id) : [...s, c.id]))} className="accent-[#14161a]" />
                    </label>
                    <button
                      type="button"
                      title="Compartilhar link"
                      onClick={async () => {
                        const url = await compartilharCondominio(c.id); // mensagem com a linha do condomínio e o link
                        try {
                          await navigator.clipboard.writeText(url);
                        } catch {
                          /* ignora */
                        }
                        setItens((l) => l?.map((x) => (x.id === c.id ? { ...x, compartilhamentos: x.compartilhamentos + 1 } : x)) ?? l);
                        if (window.confirm('Mensagem com o link do condomínio copiada. Abrir no WhatsApp?')) window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
                      }}
                      className="grid h-8 w-8 place-items-center rounded-full bg-[var(--pill-bg)] text-[13px] hover:bg-[var(--pill-bg-hover)]"
                    >
                      ↗
                    </button>
                    {/* corretor não edita condomínios: liga o próprio anúncio pelo cadastro do anúncio */}
                    {gestor ? (
                      <Link href={`/dashboard/condominios/${c.id}/editar`} className="ml-auto flex h-8 items-center rounded-full bg-ink px-3.5 text-[12px] font-semibold text-white hover:opacity-90">
                        {c.status === 'rascunho' ? 'Finalizar' : 'Editar'}
                      </Link>
                    ) : (
                      <span className="ml-auto" />
                    )}
                    <MenuAcoes
                      itens={[
                        { rotulo: 'Ver página no site', href: `/empreendimento/${c.slug ?? c.id}`, novaAba: true },
                        ...(gestor ? [{ rotulo: 'Ligar anúncios a este condomínio', href: `/dashboard/condominios/${c.id}/editar#anuncios` }] : []),
                        { rotulo: 'Fazer proposta', href: `/dashboard/propostas/nova?condominio=${c.id}` },
                        ...(gestor
                          ? [
                              {
                                rotulo: c.vendido100 ? '● 100% vendido (desmarcar)' : '○ Marcar 100% vendido',
                                onClick: async () => {
                                  if (!c.vendido100 && !window.confirm(`Marcar o ${c.nome} como 100% vendido? No site aparece "100% vendido" no lugar das unidades disponíveis (lançamento, obras e entregue há até 12 meses), e a tabela deixa de ser cobrada.`)) return;
                                  await marcarVendido100(c.id, !c.vendido100);
                                  setItens((lst) => lst?.map((x) => (x.id === c.id ? { ...x, vendido100: !c.vendido100, tabelaAcompanhar: c.vendido100, disponiveis: !c.vendido100 ? 0 : x.disponiveis } : x)) ?? lst);
                                }
                              },
                              c.tabelaAcompanhar
                                ? {
                                    rotulo: 'Parar de acompanhar a tabela',
                                    onClick: async () => {
                                      const m = window.prompt(
                                        `Por que parar de acompanhar a tabela do ${c.nome}?\n\n1 = Esgotado (100% vendido; zera as unidades disponíveis)\n2 = A incorporadora não envia mais\nOu escreva outro motivo.`,
                                        '1'
                                      );
                                      if (m === null) return;
                                      const motivo = m.trim() === '1' ? 'Esgotado (100% vendido)' : m.trim() === '2' ? 'A incorporadora não envia mais' : m.trim();
                                      await acompanharTabela(c.id, false, motivo);
                                      setItens((lst) => lst?.map((x) => (x.id === c.id ? { ...x, tabelaAcompanhar: false, tabelaMotivo: motivo, disponiveis: /esgotad/i.test(motivo) ? 0 : x.disponiveis } : x)) ?? lst);
                                    }
                                  }
                                : {
                                    rotulo: 'Voltar a acompanhar a tabela',
                                    onClick: async () => {
                                      await acompanharTabela(c.id, true);
                                      setItens((lst) => lst?.map((x) => (x.id === c.id ? { ...x, tabelaAcompanhar: true, tabelaMotivo: null } : x)) ?? lst);
                                    }
                                  },
                              {
                                rotulo: c.aceitaTemporada ? '● Aceita temporada (desmarcar)' : '○ Marcar: aceita temporada',
                                onClick: async () => {
                                  await marcarTemporadaCondominio(c.id, !c.aceitaTemporada);
                                  setItens((lst) => lst?.map((x) => (x.id === c.id ? { ...x, aceitaTemporada: !c.aceitaTemporada } : x)) ?? lst);
                                }
                              },
                              ...([
                                [0, 'Sem destaque'],
                                [2, 'Destaque: 2 colunas'],
                                [3, 'Destaque: 2 colunas e 2 linhas']
                              ] as const).map(([t, l]) => ({
                                rotulo: `${(t === 0 ? !c.destaque : c.destaque && c.destaqueTamanho === t) ? '● ' : '○ '}${l}`,
                                onClick: async () => {
                                  await marcarDestaqueFeed('condominio', c.id, t);
                                  setItens((lst) => lst?.map((x) => (x.id === c.id ? { ...x, destaque: t > 0, destaqueTamanho: (t === 3 ? 3 : 2) as 2 | 3 } : x)) ?? lst);
                                }
                              })),
                              'sep' as const,
                              {
                                rotulo: 'Excluir condomínio',
                                perigo: true,
                                onClick: async () => {
                                  if (!window.confirm(`Excluir ${c.nome}? Os anúncios ligados a ele continuam no ar (só perdem o vínculo); as tipologias são apagadas.`)) return;
                                  await excluirCondominio(c.id);
                                  setItens((l) => l?.filter((x) => x.id !== c.id) ?? l);
                                }
                              }
                            ]
                          : [])
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {filtrados.length > pagina0.length && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setPagina((p) => p + 1)} className="rounded-full bg-[var(--pill-bg)] px-5 py-2.5 text-sm font-bold">
                Mostrar mais ({filtrados.length - pagina0.length})
              </button>
            </div>
          )}
        </main>
      </div>
      </div>
      <BarraSelecao n={sel.length} onLimpar={() => setSel([])}>
        {gestor && sel.length >= 2 ? (
          <button type="button" className={botaoBarra} onClick={unificar}>
            Unificar
          </button>
        ) : (
          <span className="px-2 text-[12px] opacity-80">Selecione 2 ou mais para unificar</span>
        )}
      </BarraSelecao>

      {filtrosCel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fechar" onClick={() => setFiltrosCel(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-[330px] overflow-auto bg-[var(--bg)] p-4">
            <div className="mb-3 flex items-center justify-between font-bold">
              Filtros
              <button type="button" onClick={() => setFiltrosCel(false)} className="rounded-full bg-ink px-3 py-1.5 text-xs text-white">
                Ver {filtrados.length}
              </button>
            </div>
            {Filtro}
          </div>
        </div>
      )}
    </div>
  );
}

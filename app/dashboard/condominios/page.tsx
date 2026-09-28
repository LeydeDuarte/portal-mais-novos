'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { contarDuplicados, juntarCondominios } from '@/lib/duplicados';
import { compartilharCondominio, excluirCondominio, listarCondominiosPainel, type CondoPainel } from '@/lib/actions-painel-condominios';
import { BUCKET_LABEL, FASES, getStatusBucket, type StatusBucket } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';

const sa = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const campo = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-accent';
const rotulo = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]';
const brl = (v: number | null) => (v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);
const POR_PAGINA = 72;
const COR: Record<StatusBucket, string> = {
  breve_lancamento: '#6A3CFF',
  lancamento: '#257CFF',
  obras: '#E08A00',
  novo: '#1B5FCC',
  seminovo: '#5B6B7A',
  usado: '#3c4043',
  antigo: '#75787e'
};

type Filtros = { nome: string; uf: string; cidade: string; bairro: string; empresa: string; anoDe: string; anoAte: string; data: string; status: string; fase: string; tipo: string };
const VAZIO: Filtros = { nome: '', uf: '', cidade: '', bairro: '', empresa: '', anoDe: '', anoAte: '', data: '', status: '', fase: '', tipo: '' };

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
      if (nome && !sa(`${c.nome} ${c.bairro ?? ''}`).includes(nome)) return false;
      if (f.uf && c.uf !== f.uf) return false;
      if (f.cidade && c.cidade !== f.cidade) return false;
      if (f.bairro && c.bairro !== f.bairro) return false;
      if (f.empresa && !c.empresas.includes(f.empresa)) return false;
      if (f.data === 'com' && !c.entrega) return false;
      if (f.data === 'sem' && c.entrega) return false;
      if (f.anoDe && (!ano || ano < Number(f.anoDe))) return false;
      if (f.anoAte && (!ano || ano > Number(f.anoAte))) return false;
      if (f.status && c.status !== f.status) return false;
      if (f.tipo && c.tipo !== f.tipo) return false;
      if (f.fase && fase !== f.fase) return false;
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
      if (nome && !sa(`${c.nome} ${c.bairro ?? ''}`).includes(nome)) continue;
      if ((f.uf && c.uf !== f.uf) || (f.cidade && c.cidade !== f.cidade) || (f.bairro && c.bairro !== f.bairro) || (f.empresa && !c.empresas.includes(f.empresa))) continue;
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
    <div className="flex flex-col gap-3">
      <div>
        <span className={rotulo}>Nome</span>
        <input className={campo} value={f.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome do condomínio" />
      </div>
      <div className="grid grid-cols-[70px_1fr] gap-2">
        <div>
          <span className={rotulo}>UF</span>
          <select className={campo} value={f.uf} onChange={(e) => set('uf', e.target.value)}>
            <option value="">Todas</option>
            {opcoes.ufs.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <span className={rotulo}>Cidade</span>
          <select className={campo} value={f.cidade} onChange={(e) => set('cidade', e.target.value)}>
            <option value="">Todas</option>
            {opcoes.cidades.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <span className={rotulo}>Bairro</span>
        <select className={campo} value={f.bairro} onChange={(e) => set('bairro', e.target.value)}>
          <option value="">Todos</option>
          {opcoes.bairros.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </div>
      <div>
        <span className={rotulo}>Construtora / incorporadora</span>
        <select className={campo} value={f.empresa} onChange={(e) => set('empresa', e.target.value)}>
          <option value="">Todas</option>
          {opcoes.empresas.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </div>
      <div>
        <span className={rotulo}>Ano de entrega</span>
        <div className="grid grid-cols-2 gap-2">
          <input className={campo} inputMode="numeric" placeholder="de" value={f.anoDe} onChange={(e) => set('anoDe', e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <input className={campo} inputMode="numeric" placeholder="até" value={f.anoAte} onChange={(e) => set('anoAte', e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className={rotulo}>Data de entrega</span>
          <select className={campo} value={f.data} onChange={(e) => set('data', e.target.value)}>
            <option value="">Todos</option>
            <option value="com">Com data</option>
            <option value="sem">Sem data</option>
          </select>
        </div>
        <div>
          <span className={rotulo}>Tipo</span>
          <select className={campo} value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option value="">Todos</option>
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className={rotulo}>Fase</span>
          <select className={campo} value={f.fase} onChange={(e) => set('fase', e.target.value)}>
            <option value="">Todas</option>
            {FASES.map((x) => (
              <option key={x} value={x}>
                {BUCKET_LABEL[x]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={rotulo}>Cadastro</span>
          <select className={campo} value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Todos</option>
            <option value="publicado">Publicados</option>
            <option value="rascunho">Rascunhos</option>
          </select>
        </div>
      </div>
      {ativos > 0 && (
        <button type="button" onClick={() => setF(VAZIO)} className="rounded-full bg-[var(--pill-bg)] px-3 py-2 text-xs font-bold">
          Limpar filtros ({ativos})
        </button>
      )}
    </div>
  );

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
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <div className="flex w-full flex-1 gap-5 px-4 py-5 md:px-6">
        <aside className="sticky top-4 hidden h-fit w-[250px] shrink-0 rounded-2xl border border-[var(--border)] p-4 lg:block">{Filtro}</aside>
        <main className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-2xl font-semibold">Condomínios</h1>
            <span className="text-sm text-[var(--text-muted)]">{itens ? `${filtrados.length} de ${itens.length}` : 'Carregando…'}</span>
            <button type="button" onClick={() => setFiltrosCel(true)} className="rounded-full bg-[var(--pill-bg)] px-3 py-1.5 text-xs font-bold lg:hidden">
              Filtros{ativos ? ` (${ativos})` : ''}
            </button>
            <div className="ml-auto flex flex-wrap gap-2">
              {gestor && (
                <Link href="/dashboard/condominios/duplicados" className="rounded-full border border-[var(--border)] px-3.5 py-2 text-xs font-bold hover:bg-[var(--pill-bg)]">
                  {duplicados ? `${duplicados} possíveis duplicados` : 'Duplicados'}
                </Link>
              )}
              {gestor && (
                <Link href="/dashboard/condominios/importar" className="rounded-full border border-[var(--border)] px-3.5 py-2 text-xs font-bold hover:bg-[var(--pill-bg)]">
                  Importar planilha
                </Link>
              )}
              <Link href="/dashboard/imoveis/novo" className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white">
                + Cadastrar
              </Link>
            </div>
          </div>

          {/* contador por fase: clique para filtrar */}
          <div className="mt-3 flex flex-wrap gap-2">
            {(['breve_lancamento', 'lancamento', 'obras', 'novo'] as StatusBucket[]).map((fs) => (
              <button
                key={fs}
                type="button"
                onClick={() => set('fase', f.fase === fs ? '' : fs)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left ${f.fase === fs ? 'border-transparent text-white' : 'border-[var(--border)]'}`}
                style={f.fase === fs ? { background: COR[fs] } : undefined}
              >
                <span className="text-xl font-bold tabular-nums" style={f.fase === fs ? undefined : { color: COR[fs] }}>
                  {contagem[fs] ?? 0}
                </span>
                <span className="text-xs font-semibold leading-tight">{BUCKET_LABEL[fs]}</span>
              </button>
            ))}
          </div>

          {aviso && (
            <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" onClick={() => setAviso(null)}>
              {aviso}
            </p>
          )}
          {sel.length > 0 && (
            <div className="sticky top-2 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white">
              {sel.length} selecionado(s)
              {gestor && sel.length >= 2 && (
                <button type="button" onClick={unificar} className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold">
                  Unificar
                </button>
              )}
              <button type="button" onClick={() => setSel([])} className="ml-auto text-xs font-semibold opacity-80">
                Limpar seleção
              </button>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            {pagina0.map(({ c, fase }) => {
              const marcado = sel.includes(c.id);
              return (
                <div key={c.id} className={`flex flex-col overflow-hidden rounded-xl border bg-[var(--bg)] text-[12.5px] ${marcado ? 'border-accent ring-2 ring-accent' : 'border-[var(--border)]'}`}>
                  <a href={`/empreendimento/${c.slug ?? c.id}`} className="block">
                    <div className="relative aspect-[16/10] bg-[var(--card-img-bg)]">
                      {c.capa ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.capa} alt="" loading="lazy" className="h-full w-full object-cover" />
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
                        {c.m2Medio ? <span className="text-[var(--text-muted)]">{brl(c.m2Medio)}/m²</span> : null}
                        {c.aPartirDe ? <span className="text-[var(--text-muted)]">a partir de {brl(c.aPartirDe)}</span> : null}
                      </div>
                    </div>
                  </a>
                  <div className="mt-auto flex flex-wrap items-center gap-1 px-2.5 pb-2.5 pt-2">
                    <label className="mr-1 flex items-center" title="Selecionar para unificar">
                      <input type="checkbox" checked={marcado} onChange={() => setSel((s) => (marcado ? s.filter((x) => x !== c.id) : [...s, c.id]))} />
                    </label>
                    <Link href={`/dashboard/condominios/${c.id}/editar`} className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">
                      {c.status === 'rascunho' ? 'Finalizar' : 'Editar'}
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        const url = await compartilharCondominio(c.id);
                        try {
                          await navigator.clipboard.writeText(url);
                        } catch {
                          /* ignora */
                        }
                        setItens((l) => l?.map((x) => (x.id === c.id ? { ...x, compartilhamentos: x.compartilhamentos + 1 } : x)) ?? l);
                        if (window.confirm('Link do condomínio copiado. Abrir no WhatsApp?')) window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
                      }}
                      className="rounded-full bg-[var(--pill-bg)] px-2.5 py-1 text-[11px] font-bold"
                    >
                      Compartilhar
                    </button>
                    <Link href={`/dashboard/propostas/nova?condominio=${c.id}`} className="rounded-full bg-[var(--pill-bg)] px-2.5 py-1 text-[11px] font-bold">
                      Proposta
                    </Link>
                    {gestor && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Excluir ${c.nome}? Os anúncios ligados a ele continuam no ar (só perdem o vínculo); as tipologias são apagadas.`)) return;
                          await excluirCondominio(c.id);
                          setItens((l) => l?.filter((x) => x.id !== c.id) ?? l);
                        }}
                        className="ml-auto rounded-full px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50"
                        title="Excluir"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {itens && filtrados.length === 0 && <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum condomínio com esses filtros.</p>}
          {filtrados.length > pagina0.length && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setPagina((p) => p + 1)} className="rounded-full bg-[var(--pill-bg)] px-5 py-2.5 text-sm font-bold">
                Mostrar mais ({filtrados.length - pagina0.length})
              </button>
            </div>
          )}
        </main>
      </div>
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

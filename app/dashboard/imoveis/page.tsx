'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import ImovelCardPainel from '@/components/painel/ImovelCardPainel';
import LinkPrivadoModal from '@/components/LinkPrivadoModal';
import { useStaffSession } from '@/lib/use-staff-session';
import { deleteProperty, marcarComoVendido } from '@/lib/actions';
import { linkParaCorretor, listarImoveisPainel, mudarVisibilidade, type ImovelPainel } from '@/lib/actions-painel-imoveis';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { veTudo } from '@/lib/papeis';

const sa = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const campo = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-accent';
const rotulo = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]';
const POR_PAGINA = 60;

type Filtros = {
  busca: string;
  condominio: string;
  proprietario: string;
  tipo: string;
  finalidade: string;
  status: string;
  quartos: string;
  vagas: string;
  areaMin: string;
  areaMax: string;
  precoMin: string;
  precoMax: string;
  corretor: string;
  ordem: string;
};
const VAZIO: Filtros = { busca: '', condominio: '', proprietario: '', tipo: '', finalidade: '', status: '', quartos: '', vagas: '', areaMin: '', areaMax: '', precoMin: '', precoMax: '', corretor: '', ordem: 'recentes' };

// Painel → Imóveis: filtros na lateral (os mesmos do site + proprietário e
// condomínio) e grade de cards compactos que ocupa a tela inteira.
export default function ImoveisPainelPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [itens, setItens] = useState<ImovelPainel[] | null>(null);
  const [f, setF] = useState<Filtros>(VAZIO);
  const [pagina, setPagina] = useState(1);
  const [aviso, setAviso] = useState<string | null>(null);
  const [menu, setMenu] = useState<ImovelPainel | null>(null);
  const [linkDe, setLinkDe] = useState<ImovelPainel | null>(null);
  const [filtrosCel, setFiltrosCel] = useState(false);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff) listarImoveisPainel().then(setItens).catch(() => setItens([]));
  }, [staff]);
  useEffect(() => setPagina(1), [f]);

  const corretores = useMemo(() => Array.from(new Set((itens ?? []).map((i) => i.corretorEmail).filter((e): e is string => !!e))).sort(), [itens]);
  const lista = useMemo(() => {
    const num = (v: string) => Number(v.replace(/\D/g, '')) || 0;
    const b = sa(f.busca.trim());
    const c = sa(f.condominio.trim());
    const pr = sa(f.proprietario.trim());
    const prDig = f.proprietario.replace(/\D/g, '');
    const out = (itens ?? []).filter((i) => {
      if (f.tipo && i.tipo !== f.tipo) return false;
      if (f.finalidade && i.finalidade !== f.finalidade) return false;
      if (f.status === 'publico' && (i.visibilidade !== 'publico' || i.vendidoEm)) return false;
      if (f.status === 'privado' && i.visibilidade !== 'privado') return false;
      if (f.status === 'vendido' && !i.vendidoEm) return false;
      if (f.status === 'sem_prop' && i.proprietarios.length) return false;
      if (f.status === 'sem_foto' && i.fotos.length) return false;
      if (f.quartos && (i.quartos ?? 0) < num(f.quartos)) return false;
      if (f.vagas && (i.vagas ?? 0) < num(f.vagas)) return false;
      if (f.areaMin && (i.area ?? 0) < num(f.areaMin)) return false;
      if (f.areaMax && (i.area ?? 0) > num(f.areaMax)) return false;
      if (f.precoMin && (i.preco ?? 0) < num(f.precoMin)) return false;
      if (f.precoMax && (i.preco ?? 0) > num(f.precoMax)) return false;
      if (f.corretor && i.corretorEmail !== f.corretor) return false;
      if (c && !sa(i.condominio ?? '').includes(c)) return false;
      if (pr && !i.proprietarios.some((p) => sa(p.nome).includes(pr) || (prDig.length >= 4 && ((p.documento ?? '').includes(prDig) || (p.whatsapp ?? '').includes(prDig)))))
        return false;
      if (b && !sa([i.titulo, i.condominio, i.bairro, i.cidade, i.codigo, i.complemento, i.obsInterna].filter(Boolean).join(' ')).includes(b)) return false;
      return true;
    });
    const ord = {
      recentes: (a: ImovelPainel, z: ImovelPainel) => z.criadoEm.localeCompare(a.criadoEm),
      preco_menor: (a: ImovelPainel, z: ImovelPainel) => (a.preco ?? 0) - (z.preco ?? 0),
      preco_maior: (a: ImovelPainel, z: ImovelPainel) => (z.preco ?? 0) - (a.preco ?? 0),
      vistos: (a: ImovelPainel, z: ImovelPainel) => z.visualizacoes - a.visualizacoes
    }[f.ordem as 'recentes'];
    return out.sort(ord ?? (() => 0));
  }, [itens, f]);

  if (!loaded || !staff) return null;
  const set = (k: keyof Filtros, v: string) => setF((x) => ({ ...x, [k]: v }));
  const ativos = Object.entries(f).filter(([k, v]) => k !== 'ordem' && v).length;
  const pagina0 = lista.slice(0, pagina * POR_PAGINA);

  const atualizar = (id: string, m: Partial<ImovelPainel>) => setItens((l) => l?.map((x) => (x.id === id ? { ...x, ...m } : x)) ?? l);

  const Filtro = (
    <div className="flex flex-col gap-3">
      <div>
        <span className={rotulo}>Buscar</span>
        <input className={campo} value={f.busca} onChange={(e) => set('busca', e.target.value)} placeholder="Título, bairro, código, OBS…" />
      </div>
      <div>
        <span className={rotulo}>Condomínio</span>
        <input className={campo} value={f.condominio} onChange={(e) => set('condominio', e.target.value)} placeholder="Nome do condomínio" />
      </div>
      <div>
        <span className={rotulo}>Proprietário</span>
        <input className={campo} value={f.proprietario} onChange={(e) => set('proprietario', e.target.value)} placeholder="Nome, empresa, CPF/CNPJ ou telefone" />
      </div>
      <div>
        <span className={rotulo}>Tipo</span>
        <select className={campo} value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(TIPO_UNIDADE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className={rotulo}>Finalidade</span>
          <select className={campo} value={f.finalidade} onChange={(e) => set('finalidade', e.target.value)}>
            <option value="">Todas</option>
            <option value="venda">Venda</option>
            <option value="aluguel">Aluguel</option>
          </select>
        </div>
        <div>
          <span className={rotulo}>Situação</span>
          <select className={campo} value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Todos</option>
            <option value="publico">Públicos</option>
            <option value="privado">Privados</option>
            <option value="vendido">Vendidos</option>
            <option value="sem_prop">Sem proprietário</option>
            <option value="sem_foto">Sem foto</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className={rotulo}>Quartos (mín.)</span>
          <select className={campo} value={f.quartos} onChange={(e) => set('quartos', e.target.value)}>
            <option value="">Todos</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={rotulo}>Vagas (mín.)</span>
          <select className={campo} value={f.vagas} onChange={(e) => set('vagas', e.target.value)}>
            <option value="">Todas</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <span className={rotulo}>Área privativa (m²)</span>
        <div className="grid grid-cols-2 gap-2">
          <input className={campo} inputMode="numeric" placeholder="mín." value={f.areaMin} onChange={(e) => set('areaMin', e.target.value)} />
          <input className={campo} inputMode="numeric" placeholder="máx." value={f.areaMax} onChange={(e) => set('areaMax', e.target.value)} />
        </div>
      </div>
      <div>
        <span className={rotulo}>Valor (R$)</span>
        <div className="grid grid-cols-2 gap-2">
          <input className={campo} inputMode="numeric" placeholder="mín." value={f.precoMin} onChange={(e) => set('precoMin', e.target.value)} />
          <input className={campo} inputMode="numeric" placeholder="máx." value={f.precoMax} onChange={(e) => set('precoMax', e.target.value)} />
        </div>
      </div>
      {veTudo(staff.role) && corretores.length > 1 && (
        <div>
          <span className={rotulo}>Corretor</span>
          <select className={campo} value={f.corretor} onChange={(e) => set('corretor', e.target.value)}>
            <option value="">Todos</option>
            {corretores.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
      {ativos > 0 && (
        <button type="button" onClick={() => setF(VAZIO)} className="rounded-full bg-[var(--pill-bg)] px-3 py-2 text-xs font-bold">
          Limpar filtros ({ativos})
        </button>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <div className="flex w-full flex-1 gap-5 px-4 py-5 md:px-6">
        <aside className="sticky top-4 hidden h-fit w-[250px] shrink-0 rounded-2xl border border-[var(--border)] p-4 lg:block">{Filtro}</aside>
        <main className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-2xl font-semibold">{veTudo(staff.role) ? 'Imóveis' : 'Meus imóveis'}</h1>
            <span className="text-sm text-[var(--text-muted)]">{itens ? `${lista.length} de ${itens.length}` : 'Carregando…'}</span>
            <button type="button" onClick={() => setFiltrosCel(true)} className="rounded-full bg-[var(--pill-bg)] px-3 py-1.5 text-xs font-bold lg:hidden">
              Filtros{ativos ? ` (${ativos})` : ''}
            </button>
            <select value={f.ordem} onChange={(e) => set('ordem', e.target.value)} className="ml-auto rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold">
              <option value="recentes">Mais recentes</option>
              <option value="preco_menor">Menor valor</option>
              <option value="preco_maior">Maior valor</option>
              <option value="vistos">Mais vistos</option>
            </select>
            <Link href="/dashboard/imoveis/novo" className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              + Cadastrar
            </Link>
          </div>
          {aviso && (
            <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" onClick={() => setAviso(null)}>
              {aviso}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
            {pagina0.map((i) => (
              <ImovelCardPainel
                key={i.id}
                i={i}
                onPrivar={async () => {
                  const vis = i.visibilidade === 'privado' ? 'publico' : 'privado';
                  await mudarVisibilidade(i.id, vis);
                  atualizar(i.id, { visibilidade: vis });
                  setAviso(vis === 'privado' ? 'Anúncio privado: saiu do feed e do Google; só abre pelo link privado.' : 'Anúncio público de novo.');
                }}
                onCompartilhar={async () => {
                  const r = await linkParaCorretor(i.id);
                  if (!r.ok) return setAviso(r.erro);
                  atualizar(i.id, { compartilhamentos: i.compartilhamentos + 1 });
                  const texto = `Imóvel para o seu cliente: ${r.url}`;
                  try {
                    await navigator.clipboard.writeText(r.url);
                  } catch {
                    /* sem permissão de copiar */
                  }
                  if (window.confirm('Link para corretor copiado (resumo sem nossos contatos e com a sua marca d’água). Abrir no WhatsApp?'))
                    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
                }}
                onMais={() => setMenu(i)}
              />
            ))}
          </div>
          {itens && lista.length === 0 && <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum imóvel com esses filtros.</p>}
          {lista.length > pagina0.length && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setPagina((p) => p + 1)} className="rounded-full bg-[var(--pill-bg)] px-5 py-2.5 text-sm font-bold">
                Mostrar mais ({lista.length - pagina0.length})
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
                Ver {lista.length}
              </button>
            </div>
            {Filtro}
          </div>
        </div>
      )}

      {menu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setMenu(null)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-[var(--bg)] p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 truncate font-bold">{menu.condominio ?? menu.titulo ?? 'Imóvel'}</div>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link href={`/dashboard/propostas/nova?imovel=${menu.id}`} className="rounded-lg px-3 py-2.5 font-semibold hover:bg-[var(--pill-bg)]">
                Fazer proposta
              </Link>
              <button type="button" onClick={() => (setLinkDe(menu), setMenu(null))} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--pill-bg)]">
                Enviar link privado para cliente
              </button>
              <a href={`/imovel/${menu.slug ?? menu.id}`} target="_blank" rel="noopener" className="rounded-lg px-3 py-2.5 font-semibold hover:bg-[var(--pill-bg)]">
                Ver página no site
              </a>
              {!menu.vendidoEm && (
                <button
                  type="button"
                  onClick={async () => {
                    const valor = window.prompt('Marcar como VENDIDO. Valor de venda (opcional, só números):', '');
                    if (valor === null) return;
                    await marcarComoVendido(menu.id, Number(valor.replace(/\D/g, '')) || undefined);
                    atualizar(menu.id, { vendidoEm: new Date().toISOString() });
                    setMenu(null);
                  }}
                  className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--pill-bg)]"
                >
                  Marcar como vendido
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('Excluir este imóvel? Ele sai do site, mas os dados ficam no histórico de mercado.')) return;
                  await deleteProperty(menu.id);
                  setItens((l) => l?.filter((x) => x.id !== menu.id) ?? l);
                  setMenu(null);
                }}
                className="rounded-lg px-3 py-2.5 text-left font-semibold text-red-600 hover:bg-red-50"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      {linkDe && <LinkPrivadoModal propertyId={linkDe.id} titulo={linkDe.condominio ?? linkDe.titulo ?? 'Imóvel'} onClose={() => setLinkDe(null)} />}
    </div>
  );
}

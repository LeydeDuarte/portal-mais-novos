'use client';

import { linhaImovel, mensagemComLink } from '@/lib/compartilhar';
import { urlImovel } from '@/lib/urls';
const SITE_PUBLICO = process.env.NEXT_PUBLIC_SITE_URL || 'https://maisnovosimoveis.com';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import ImovelCardPainel from '@/components/painel/ImovelCardPainel';
import LinkPrivadoModal from '@/components/LinkPrivadoModal';
import { BarraSelecao, BuscaGrande, Chips, marcados, FiltrosAtivos, SecaoFiltro, TituloPainel, Vazio, botaoBarra, botaoBarraSec, campoPainel } from '@/components/painel/ui';
import VincularCondominioModal from '@/components/forms/VincularCondominioModal';
import { useStaffSession } from '@/lib/use-staff-session';
import { deleteProperty, marcarComoVendido, marcarDestaqueFeed } from '@/lib/actions';
import { linkParaCorretor, listarImoveisPainel, mudarVisibilidade, type ImovelPainel } from '@/lib/actions-painel-imoveis';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { veTudo } from '@/lib/papeis';

const sa = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const POR_PAGINA = 48;

type Filtros = {
  busca: string;
  condominio: string;
  proprietario: string;
  tipo: string;
  finalidade: string;
  status: string;
  quartos: string;
  banheiros: string;
  vagas: string;
  areaMin: string;
  areaMax: string;
  precoMin: string;
  precoMax: string;
  corretor: string;
};
const VAZIO: Filtros = { busca: '', condominio: '', proprietario: '', tipo: '', finalidade: '', status: '', quartos: '', banheiros: '', vagas: '', areaMin: '', areaMax: '', precoMin: '', precoMax: '', corretor: '' };
const STATUS: Record<string, string> = { publico: 'Públicos', privado: 'Privados', vendido: 'Vendidos', sem_prop: 'Sem proprietário', sem_foto: 'Sem foto' };

// Painel → Imóveis: busca grande, filtros na lateral (chips), cards com foto à
// esquerda em várias colunas e barra flutuante para ações em vários de uma vez.
export default function ImoveisPainelPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [itens, setItens] = useState<ImovelPainel[] | null>(null);
  const [f, setF] = useState<Filtros>(VAZIO);
  const [ordem, setOrdem] = useState('recentes');
  const [pagina, setPagina] = useState(1);
  const [aviso, setAviso] = useState<string | null>(null);
  const [linkDe, setLinkDe] = useState<ImovelPainel | null>(null);
  const [vincular, setVincular] = useState<string[] | null>(null);
  const [filtrosCel, setFiltrosCel] = useState(false);
  const [sel, setSel] = useState<string[]>([]);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff) listarImoveisPainel().then(setItens).catch(() => setItens([]));
  }, [staff]);
  useEffect(() => setPagina(1), [f, ordem]);

  const corretores = useMemo(() => Array.from(new Set((itens ?? []).map((i) => i.corretorEmail).filter((e): e is string => !!e))).sort(), [itens]);
  const lista = useMemo(() => {
    const num = (v: string) => Number(v.replace(/\D/g, '')) || 0;
    const b = sa(f.busca.trim());
    const c = sa(f.condominio.trim());
    const pr = sa(f.proprietario.trim());
    const prDig = f.proprietario.replace(/\D/g, '');
    const out = (itens ?? []).filter((i) => {
      const tipos = marcados(f.tipo);
      if (tipos.length && !tipos.includes(i.tipo)) return false;
      const fins = marcados(f.finalidade);
      if (fins.length && !fins.includes(i.finalidade)) return false;
      // Situação: várias marcadas = basta uma bater
      const sits = marcados(f.status);
      if (
        sits.length &&
        !sits.some(
          (s) =>
            (s === 'publico' && i.visibilidade === 'publico' && !i.vendidoEm) ||
            (s === 'privado' && i.visibilidade === 'privado') ||
            (s === 'vendido' && !!i.vendidoEm) ||
            (s === 'sem_prop' && !i.proprietarios.length) ||
            (s === 'sem_foto' && !i.fotos.length)
        )
      )
        return false;
      // Quartos / banheiros / vagas: valores marcados de 0 a 4+ (4 = 4 ou mais)
      const bate = (csv: string, v: number | null) => {
        const l = marcados(csv).map(Number);
        return !l.length || l.includes(v ?? 0) || (l.includes(4) && (v ?? 0) >= 4);
      };
      if (!bate(f.quartos, i.quartos)) return false;
      if (!bate(f.banheiros, i.banheiros)) return false;
      if (!bate(f.vagas, i.vagas)) return false;
      if (f.areaMin && (i.area ?? 0) < num(f.areaMin)) return false;
      if (f.areaMax && (i.area ?? 0) > num(f.areaMax)) return false;
      if (f.precoMin && (i.preco ?? 0) < num(f.precoMin)) return false;
      if (f.precoMax && (i.preco ?? 0) > num(f.precoMax)) return false;
      if (f.corretor && i.corretorEmail !== f.corretor) return false;
      if (c && !sa(i.condominio ?? '').includes(c)) return false;
      if (pr && !i.proprietarios.some((p) => sa(p.nome).includes(pr) || (prDig.length >= 4 && ((p.documento ?? '').includes(prDig) || (p.whatsapp ?? '').includes(prDig)))))
        return false;
      if (b && !sa([i.titulo, i.condominio, i.bairro, i.cidade, i.codigo, i.complemento, i.obsInterna, ...i.proprietarios.map((p) => p.nome)].filter(Boolean).join(' ')).includes(b))
        return false;
      return true;
    });
    const fn = {
      recentes: (a: ImovelPainel, z: ImovelPainel) => z.criadoEm.localeCompare(a.criadoEm),
      preco_menor: (a: ImovelPainel, z: ImovelPainel) => (a.preco ?? 0) - (z.preco ?? 0),
      preco_maior: (a: ImovelPainel, z: ImovelPainel) => (z.preco ?? 0) - (a.preco ?? 0),
      vistos: (a: ImovelPainel, z: ImovelPainel) => z.visualizacoes - a.visualizacoes
    }[ordem as 'recentes'];
    return fn ? out.sort(fn) : out;
  }, [itens, f, ordem]);

  // contagem por tipo (para os chips)
  const porTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of itens ?? []) m.set(i.tipo, (m.get(i.tipo) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [itens]);

  if (!loaded || !staff) return null;
  const set = (k: keyof Filtros, v: string) => setF((x) => ({ ...x, [k]: v }));
  const atualizar = (id: string, m: Partial<ImovelPainel>) => setItens((l) => l?.map((x) => (x.id === id ? { ...x, ...m } : x)) ?? l);
  const pagina0 = lista.slice(0, pagina * POR_PAGINA);

  const ativos = [
    f.tipo && { rotulo: marcados(f.tipo).map((t) => TIPO_UNIDADE_LABEL[t as TipoUnidade] ?? t).join(', '), tirar: () => set('tipo', '') },
    f.finalidade && { rotulo: marcados(f.finalidade).map((x) => (x === 'venda' ? 'Venda' : 'Aluguel')).join(', '), tirar: () => set('finalidade', '') },
    f.status && { rotulo: marcados(f.status).map((x) => STATUS[x] ?? x).join(', '), tirar: () => set('status', '') },
    f.quartos && { rotulo: `${marcados(f.quartos).map((x) => (x === '4' ? '4+' : x)).join(', ')} quartos`, tirar: () => set('quartos', '') },
    f.banheiros && { rotulo: `${marcados(f.banheiros).map((x) => (x === '4' ? '4+' : x)).join(', ')} banheiros`, tirar: () => set('banheiros', '') },
    f.vagas && { rotulo: `${marcados(f.vagas).map((x) => (x === '4' ? '4+' : x)).join(', ')} vagas`, tirar: () => set('vagas', '') },
    f.condominio && { rotulo: `Cond.: ${f.condominio}`, tirar: () => set('condominio', '') },
    f.proprietario && { rotulo: `Prop.: ${f.proprietario}`, tirar: () => set('proprietario', '') },
    (f.areaMin || f.areaMax) && { rotulo: `${f.areaMin || 0}–${f.areaMax || '∞'} m²`, tirar: () => setF((x) => ({ ...x, areaMin: '', areaMax: '' })) },
    (f.precoMin || f.precoMax) && { rotulo: `R$ ${f.precoMin || 0}–${f.precoMax || '∞'}`, tirar: () => setF((x) => ({ ...x, precoMin: '', precoMax: '' })) },
    f.corretor && { rotulo: f.corretor, tirar: () => set('corretor', '') }
  ].filter(Boolean) as { rotulo: string; tirar: () => void }[];

  // Link público para o cliente, com a linha do anúncio em cima (tipo, local, quartos, m², preço)
  const enviarCliente = async (i: ImovelPainel, como: 'whatsapp' | 'copiar') => {
    const texto = mensagemComLink(linhaImovel(i), `${SITE_PUBLICO}${urlImovel(i)}`);
    if (como === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      setAviso('Mensagem com o link copiada. É só colar na conversa do cliente.');
    } catch {
      window.prompt('Copie a mensagem com o link:', texto);
    }
  };

  const compartilhar = async (varios: ImovelPainel[]) => {
    const links: string[] = [];
    for (const i of varios.filter((x) => x.visibilidade !== 'privado')) {
      const r = await linkParaCorretor(i.id);
      if (r.ok) {
        links.push(`${i.condominio ?? i.titulo ?? 'Imóvel'}: ${r.url}`);
        atualizar(i.id, { compartilhamentos: i.compartilhamentos + 1 });
      }
    }
    if (!links.length) return setAviso('Anúncios privados não podem ser enviados a outros corretores.');
    const texto = `Imóveis para o seu cliente:\n${links.join('\n')}`;
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      /* ignora */
    }
    if (window.confirm(`${links.length} link(s) para corretor copiado(s) (resumo sem nossos contatos). Abrir no WhatsApp?`))
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const Filtros = (
    <div className="flex flex-col gap-6">
      <SecaoFiltro titulo="Situação">
        <Chips opcoes={Object.entries(STATUS).map(([v, l]) => ({ v, l }))} valor={f.status} onChange={(v) => set('status', v)} multi />
      </SecaoFiltro>
      <SecaoFiltro titulo="Tipo">
        <Chips opcoes={porTipo.map(([v, n]) => ({ v, l: TIPO_UNIDADE_LABEL[v as TipoUnidade] ?? v, n }))} valor={f.tipo} onChange={(v) => set('tipo', v)} multi />
      </SecaoFiltro>
      <SecaoFiltro titulo="Finalidade">
        <Chips
          opcoes={[
            { v: 'venda', l: 'Venda' },
            { v: 'aluguel', l: 'Aluguel' }
          ]}
          valor={f.finalidade}
          onChange={(v) => set('finalidade', v)}
          multi
        />
      </SecaoFiltro>
      <SecaoFiltro titulo="Quartos">
        <Chips opcoes={['0', '1', '2', '3', '4'].map((v) => ({ v, l: v === '4' ? '4+' : v }))} valor={f.quartos} onChange={(v) => set('quartos', v)} multi />
      </SecaoFiltro>
      <SecaoFiltro titulo="Banheiros">
        <Chips opcoes={['0', '1', '2', '3', '4'].map((v) => ({ v, l: v === '4' ? '4+' : v }))} valor={f.banheiros} onChange={(v) => set('banheiros', v)} multi />
      </SecaoFiltro>
      <SecaoFiltro titulo="Vagas">
        <Chips opcoes={['0', '1', '2', '3', '4'].map((v) => ({ v, l: v === '4' ? '4+' : v }))} valor={f.vagas} onChange={(v) => set('vagas', v)} multi />
      </SecaoFiltro>
      <SecaoFiltro titulo="Condomínio">
        <input className={campoPainel} value={f.condominio} onChange={(e) => set('condominio', e.target.value)} placeholder="Nome do condomínio" />
      </SecaoFiltro>
      <SecaoFiltro titulo="Proprietário">
        <input className={campoPainel} value={f.proprietario} onChange={(e) => set('proprietario', e.target.value)} placeholder="Nome, empresa, CPF/CNPJ ou telefone" />
      </SecaoFiltro>
      <SecaoFiltro titulo="Área privativa (m²)">
        <div className="grid grid-cols-2 gap-2">
          <input className={campoPainel} inputMode="numeric" placeholder="mín." value={f.areaMin} onChange={(e) => set('areaMin', e.target.value)} />
          <input className={campoPainel} inputMode="numeric" placeholder="máx." value={f.areaMax} onChange={(e) => set('areaMax', e.target.value)} />
        </div>
      </SecaoFiltro>
      <SecaoFiltro titulo="Valor (R$)">
        <div className="grid grid-cols-2 gap-2">
          <input className={campoPainel} inputMode="numeric" placeholder="mín." value={f.precoMin} onChange={(e) => set('precoMin', e.target.value)} />
          <input className={campoPainel} inputMode="numeric" placeholder="máx." value={f.precoMax} onChange={(e) => set('precoMax', e.target.value)} />
        </div>
      </SecaoFiltro>
      {veTudo(staff.role) && corretores.length > 1 && (
        <SecaoFiltro titulo="Corretor">
          <select className={campoPainel} value={f.corretor} onChange={(e) => set('corretor', e.target.value)}>
            <option value="">Todos</option>
            {corretores.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </SecaoFiltro>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <PainelNav />
      <div className="mx-auto max-w-[1680px] px-4 pb-24 pt-6 md:px-6 md:pt-8">
        <div className="flex flex-col gap-5">
          <TituloPainel
            titulo={veTudo(staff.role) ? 'Imóveis' : 'Meus imóveis'}
            contagem={
              itens ? (
                <>
                  <strong className="text-[var(--text)]">{lista.length}</strong> de {itens.length} imóveis
                </>
              ) : (
                'Carregando…'
              )
            }
          >
            <button type="button" onClick={() => setFiltrosCel(true)} className="h-11 rounded-full bg-[var(--pill-bg)] px-4 text-[13px] font-semibold md:hidden">
              Filtros{ativos.length ? ` (${ativos.length})` : ''}
            </button>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)} className="h-11 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-[13px] font-semibold">
              <option value="recentes">Mais recentes</option>
              <option value="preco_menor">Menor valor</option>
              <option value="preco_maior">Maior valor</option>
              <option value="vistos">Mais vistos</option>
            </select>
            <Link href="/dashboard/imoveis/novo" className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-white hover:opacity-90">
              + Novo imóvel
            </Link>
          </TituloPainel>
          <BuscaGrande value={f.busca} onChange={(v) => set('busca', v)} placeholder="Buscar por condomínio, bairro, código, proprietário ou OBS" />
          <FiltrosAtivos itens={ativos} onLimpar={() => setF(VAZIO)} />
          {aviso && (
            <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" onClick={() => setAviso(null)}>
              {aviso}
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-6">
          <aside className="hidden w-[250px] shrink-0 md:block">
            <div className="sticky top-[132px] max-h-[calc(100vh-150px)] overflow-y-auto pr-2 [scrollbar-width:thin]">{Filtros}</div>
          </aside>
          <main className="min-w-0 flex-1">
            {itens && lista.length === 0 ? (
              <Vazio titulo="Nenhum imóvel encontrado" texto="Tente ajustar a busca ou os filtros." />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2 2xl:grid-cols-3 min-[1900px]:grid-cols-4">
                {pagina0.map((i) => (
                  <ImovelCardPainel
                    key={i.id}
                    i={i}
                    selecionado={sel.includes(i.id)}
                    onSelecionar={() => setSel((s) => (s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id]))}
                    onPrivar={async () => {
                      const vis = i.visibilidade === 'privado' ? 'publico' : 'privado';
                      await mudarVisibilidade(i.id, vis);
                      atualizar(i.id, { visibilidade: vis });
                      setAviso(vis === 'privado' ? 'Anúncio privado: saiu do feed e do Google; só abre pelo link privado.' : 'Anúncio público de novo.');
                    }}
                    onCompartilhar={() => compartilhar([i])}
                    menu={[
                      { rotulo: 'Abrir ficha', href: `/dashboard/imoveis/${i.id}` },
                      { rotulo: 'Fazer proposta', href: `/dashboard/propostas/nova?imovel=${i.id}` },
                      ...(i.visibilidade !== 'privado'
                        ? [
                            { rotulo: 'Enviar para cliente (WhatsApp)', onClick: () => enviarCliente(i, 'whatsapp') },
                            { rotulo: 'Copiar link para cliente', onClick: () => enviarCliente(i, 'copiar') }
                          ]
                        : []),
                      { rotulo: 'Link privado para cliente', onClick: () => setLinkDe(i) },
                      { rotulo: 'Ver página no site', href: urlImovel(i), novaAba: true },
                      { rotulo: 'Ligar a um condomínio', onClick: () => setVincular([i.id]) },
                      ...(veTudo(staff.role)
                        ? [
                            ...([
                              [0, 'Sem destaque'],
                              [2, 'Destaque: 2 colunas'],
                              [3, 'Destaque: 2 colunas e 2 linhas']
                            ] as const).map(([t, l]) => ({
                              rotulo: `${(t === 0 ? !i.destaque : i.destaque && i.destaqueTamanho === t) ? '● ' : '○ '}${l}`,
                              onClick: async () => {
                                await marcarDestaqueFeed('imovel', i.id, t);
                                atualizar(i.id, { destaque: t > 0, destaqueTamanho: t === 3 ? 3 : 2 });
                              }
                            }))
                          ]
                        : []),
                      'sep',
                      ...(!i.vendidoEm
                        ? [
                            {
                              rotulo: 'Marcar como vendido',
                              onClick: async () => {
                                const valor = window.prompt('Marcar como VENDIDO. Valor de venda (opcional, só números):', '');
                                if (valor === null) return;
                                await marcarComoVendido(i.id, Number(valor.replace(/\D/g, '')) || undefined);
                                atualizar(i.id, { vendidoEm: new Date().toISOString() });
                              }
                            }
                          ]
                        : []),
                      {
                        rotulo: 'Excluir',
                        perigo: true,
                        onClick: async () => {
                          if (!window.confirm('Excluir este imóvel? Ele sai do site, mas os dados ficam no histórico de mercado.')) return;
                          await deleteProperty(i.id);
                          setItens((l) => l?.filter((x) => x.id !== i.id) ?? l);
                        }
                      }
                    ]}
                  />
                ))}
              </div>
            )}
            {lista.length > pagina0.length && (
              <div className="mt-10 flex flex-col items-center gap-3">
                <button type="button" onClick={() => setPagina((p) => p + 1)} className="flex h-11 items-center gap-2 rounded-full bg-[var(--pill-bg)] px-6 text-[14px] font-semibold hover:bg-[var(--pill-bg-hover)]">
                  Carregar mais
                </button>
                <span className="text-[12px] text-[var(--text-muted)]">
                  Mostrando {pagina0.length} de {lista.length}
                </span>
              </div>
            )}
          </main>
        </div>
      </div>

      <BarraSelecao n={sel.length} onLimpar={() => setSel([])}>
        <button type="button" className={botaoBarraSec} onClick={() => setVincular(sel)}>
          Ligar a condomínio
        </button>
        <button type="button" className={botaoBarra} onClick={() => compartilhar((itens ?? []).filter((i) => sel.includes(i.id)))}>
          Enviar p/ corretor
        </button>
        <button
          type="button"
          className={botaoBarraSec}
          onClick={async () => {
            for (const id of sel) await mudarVisibilidade(id, 'privado');
            setItens((l) => l?.map((x) => (sel.includes(x.id) ? { ...x, visibilidade: 'privado' } : x)) ?? l);
            setSel([]);
          }}
        >
          Privar
        </button>
        <button
          type="button"
          className={botaoBarraSec}
          onClick={async () => {
            for (const id of sel) await mudarVisibilidade(id, 'publico');
            setItens((l) => l?.map((x) => (sel.includes(x.id) ? { ...x, visibilidade: 'publico' } : x)) ?? l);
            setSel([]);
          }}
        >
          Publicar
        </button>
      </BarraSelecao>

      {filtrosCel && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Fechar" onClick={() => setFiltrosCel(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute left-0 top-0 h-full w-[88%] max-w-[340px] overflow-auto bg-[var(--bg)] p-5">
            <div className="mb-5 flex items-center justify-between">
              <span className="font-serif text-xl font-semibold">Filtros</span>
              <button type="button" onClick={() => setFiltrosCel(false)} className="h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-white">
                Ver {lista.length}
              </button>
            </div>
            {Filtros}
          </div>
        </div>
      )}
      {vincular && (
        <VincularCondominioModal
          ids={vincular}
          onClose={() => setVincular(null)}
          onDone={(_, nome) => {
            setItens((l) => l?.map((x) => (vincular.includes(x.id) ? { ...x, condominio: nome } : x)) ?? l);
            setAviso(`${vincular.length} anúncio${vincular.length === 1 ? '' : 's'} ligado${vincular.length === 1 ? '' : 's'} ao ${nome}.`);
            setVincular(null);
            setSel([]);
          }}
        />
      )}
      {linkDe && <LinkPrivadoModal propertyId={linkDe.id} titulo={linkDe.condominio ?? linkDe.titulo ?? 'Imóvel'} linha={linhaImovel(linkDe)} onClose={() => setLinkDe(null)} />}
    </div>
  );
}

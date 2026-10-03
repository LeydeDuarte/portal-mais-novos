'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { aprenderPerfil } from '@/lib/perfil-cliente';
import { getDestaquesFeed, getFeedPage, getAnunciosOcultos, contarImoveisAVenda, feedModoEquipe, condominiosDosBairros, type FeedItem, type AnuncioOculto, type CondoDoBairro } from '@/lib/actions';
import Link from 'next/link';
import { countActiveFilters, type FilterState } from '@/lib/filters';
import OcultoCard from './OcultoCard';
import { useFavorites } from '@/lib/use-favorites';
import { useSession } from '@/lib/use-session';
import PropertyCard from './PropertyCard';
import DevelopmentCard from './DevelopmentCard';
import FeedGrid, { type ItemGrade } from './feed/FeedGrid';
import FeedModoToggle from './feed/FeedModoToggle';
import DestaqueRotativo from './feed/DestaqueRotativo';
import DepoimentoCard from './DepoimentoCard';
import DestaqueCard from './DestaqueCard';
import LoginModal from './LoginModal';
import type { Cliente } from '@/lib/cliente-auth';
import { urlImovel, urlCondominio } from '@/lib/urls';

export type FeedInicial = { items: FeedItem[]; hasMore: boolean; totalAVenda: number; modoEquipe: boolean; filtrosChave: string; modoFeed?: 'masonry' | 'alinhado'; escolheuFeed?: boolean; destaques?: FeedItem[] };

const chaveItem = (i: FeedItem) =>
  i.kind === 'empreendimento' ? `d-${i.development.id}` : i.kind === 'imovel' ? `p-${i.property.id}` : i.chave;

// Destaques continuam na rolagem: cada anúncio ou condomínio marcado como destaque também
// entra como card normal (tamanho original) nas primeiras páginas do feed, numa posição
// fixa por item (a mesma no servidor e no navegador), longe dos espaços de destaque.
// Se ele já veio numa página normal, nada é acrescentado (sem repetição).
function posicaoDoDestaque(chave: string): number {
  let h = 0;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) >>> 0;
  let pos = 8 + (h % 40);
  // longe dos espaços de destaque (3º lugar e a cada 20 itens)
  while ((pos - 2) % 20 <= 1 || (pos - 2) % 20 >= 18) pos += 1;
  return pos;
}
function comDestaquesNaRolagem(lista: FeedItem[], destaques: FeedItem[]): FeedItem[] {
  if (!destaques.length) return lista;
  const ja = new Set(lista.map(chaveItem));
  const faltam = destaques.filter((d) => (d.kind === 'imovel' || d.kind === 'empreendimento') && !ja.has(chaveItem(d)));
  if (!faltam.length) return lista;
  const out = lista.slice();
  faltam
    .map((d) => ({ d, pos: posicaoDoDestaque(chaveItem(d)) }))
    .sort((a, b) => a.pos - b.pos)
    .forEach(({ d, pos }) => out.splice(Math.min(pos, out.length), 0, d));
  return out;
}

export default function MasonryFeed({ filters, inicial }: { filters: FilterState; inicial?: FeedInicial }) {
  // destaques da equipe que combinam com esta busca (espaço de 2 colunas que se reveza)
  const filtrosJson = JSON.stringify(filters);
  // na 1ª pintura os destaques já vieram do servidor: só busca de novo quando a busca muda
  const destaquesDoServidor = useRef(inicial?.destaques ? inicial.filtrosChave : null);
  useEffect(() => {
    if (destaquesDoServidor.current === filtrosJson) {
      destaquesDoServidor.current = null;
      return;
    }
    destaquesDoServidor.current = null;
    // a busca mudou: os destaques antigos saem até chegarem os desta busca
    destaquesRef.current = [];
    setDestaques([]);
    let vivo = true;
    getDestaquesFeed(JSON.parse(filtrosJson))
      .then((d) => vivo && setDestaques(d))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [filtrosJson]);
  // 1ª página já vem pronta do servidor (aparece na hora e o Google enxerga os links)
  const usarInicial = useRef(!!inicial);
  const [items, setItems] = useState<FeedItem[]>(() => comDestaquesNaRolagem(inicial?.items ?? [], inicial?.destaques ?? []));
  const [modoFeed, setModoFeed] = useState<'masonry' | 'alinhado'>(inicial?.modoFeed ?? 'masonry');
  const [escolheuFeed, setEscolheuFeed] = useState(!!inicial?.escolheuFeed);
  const [destaques, setDestaques] = useState<FeedItem[]>(inicial?.destaques ?? []);
  const destaquesRef = useRef(destaques);
  useEffect(() => {
    destaquesRef.current = destaques;
    // destaques que chegaram depois da 1ª página também entram na rolagem
    setItems((prev) => (prev.length ? comDestaquesNaRolagem(prev, destaques) : prev));
  }, [destaques]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [ocultos, setOcultos] = useState<AnuncioOculto[]>([]);
  const [totalAVenda, setTotalAVenda] = useState<number | null>(inicial?.totalAVenda ?? null);
  const [modoEquipe, setModoEquipe] = useState(inicial?.modoEquipe ?? false);
  useEffect(() => {
    if (inicial) return;
    contarImoveisAVenda().then(setTotalAVenda).catch(() => {});
    feedModoEquipe().then(setModoEquipe).catch(() => {});
  }, [inicial]);

  // Aprende o perfil com o que a pessoa filtra (ordena o feed nas próximas vezes)
  useEffect(() => {
    const bairros = filters.locais.filter((l) => l.tipo === 'bairro').map((l) => l.nome);
    const preco = filters.precoMin && filters.precoMax ? (filters.precoMin + filters.precoMax) / 2 : filters.precoMax ?? null;
    if (filters.tipos.length || bairros.length || preco) aprenderPerfil({ tipos: filters.tipos, bairros, preco, peso: 2 });
  }, [filters]);
  const filtrando = countActiveFilters(filters) > 0;
  const pendingFavoriteId = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { favorites, toggleFavorite } = useFavorites();
  const { session, signIn } = useSession();

  // Evita que uma resposta atrasada (de um filtro anterior) sobrescreva a atual
  const requestId = useRef(0);
  const loadPage = useCallback(
    async (pageToLoad: number, reset: boolean) => {
      const myId = ++requestId.current;
      setLoading(true);
      try {
        const { items: newItems, hasMore, total } = await getFeedPage(pageToLoad, filters);
        if (myId !== requestId.current) return;
        // a contagem do cabeçalho acompanha os filtros (vem junto da 1ª página)
        if (pageToLoad === 0 && typeof total === 'number') setTotalAVenda(total);
        setItems((prev) => {
          if (reset) return comDestaquesNaRolagem(newItems, destaquesRef.current);
          const vistos = new Set(prev.map(chaveItem));
          return [...prev, ...newItems.filter((i) => !vistos.has(chaveItem(i)))];
        });
        setDone(!hasMore);
      } catch {
        if (myId === requestId.current) setDone(true);
      } finally {
        if (myId === requestId.current) setLoading(false);
      }
    },
    [filters]
  );

  // A filtragem agora acontece no banco de dados, não mais sobre o que já
  // carregou no navegador — então quando os filtros mudam, a busca
  // recomeça do zero em vez de só re-filtrar a lista local.
  // Fim da busca com filtro: mostra os anúncios RESERVADOS (privados) que
  // atendem a mesma busca — só características, sem fotos nem endereço.
  useEffect(() => {
    setOcultos([]);
    if (!done || !filtrando) return;
    let vivo = true;
    getAnunciosOcultos(filters)
      .then((o) => vivo && setOcultos(o))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [done, filtrando, filters]);

  // Filtro por bairro: no fim da lista, os nomes de todos os condomínios do bairro
  const [condosBairro, setCondosBairro] = useState<CondoDoBairro[]>([]);
  const [verTodosCondos, setVerTodosCondos] = useState(false);
  useEffect(() => {
    setCondosBairro([]);
    setVerTodosCondos(false);
    const bairros = filters.locais.filter((l) => l.tipo === 'bairro').map((l) => ({ nome: l.nome, cidade: l.cidade }));
    if (!bairros.length) return;
    let vivo = true;
    condominiosDosBairros(bairros)
      .then((c) => vivo && setCondosBairro(c))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [filters]);

  useEffect(() => {
    setPage(0);
    if (usarInicial.current && inicial && JSON.stringify(filters) === inicial.filtrosChave) {
      usarInicial.current = false;
      setDone(!inicial.hasMore);
      return;
    }
    usarInicial.current = false;
    loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loading && !done) {
            const next = page + 1;
            setPage(next);
            loadPage(next, false);
          }
        }),
      { rootMargin: '600px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, done, loading, loadPage]);

  const handleFavoriteClick = (id: string) => {
    if (!session.loggedIn) {
      pendingFavoriteId.current = id;
      setModalOpen(true);
      return;
    }
    toggleFavorite(id);
  };

  const handleSignIn = (cliente?: Cliente | null) => {
    signIn(cliente);
    setModalOpen(false);
    if (pendingFavoriteId.current) {
      toggleFavorite(pendingFavoriteId.current);
      pendingFavoriteId.current = null;
    }
  };

  const handleDwell = (id: string, ms: number) => {
    // Ainda local por enquanto (localStorage) — o motor de recomendação de
    // verdade (ver documento de arquitetura) é a próxima peça a entrar no
    // banco, junto dos favoritos.
    try {
      const key = 'mn_interactions';
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      stored[id] = { ...(stored[id] || {}), viewMs: (stored[id]?.viewMs || 0) + ms };
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // ignora falha de storage
    }
  };

  const renderItem = (item: FeedItem, idx: number, largo = false, grande = false) =>
    item.kind === 'depoimento' ? (
      <DepoimentoCard d={item.depoimento} />
    ) : item.kind === 'destaque' ? (
      <DestaqueCard d={item.destaque} grande={grande} />
    ) : item.kind === 'empreendimento' ? (
      <DevelopmentCard
        development={item.development}
        prioridade={idx < 4 || largo}
        emDestaque={largo}
        isFavorite={!!favorites[item.development.id]}
        onFavoriteClick={handleFavoriteClick}
      />
    ) : (
      <PropertyCard
        property={item.property}
        isFavorite={!!favorites[item.property.id]}
        loggedIn={session.loggedIn}
        onFavoriteClick={handleFavoriteClick}
        onDwell={handleDwell}
        prioridade={idx < 4 || largo}
        emDestaque={largo}
      />
    );
  const estimar = (item: FeedItem) =>
    item.kind === 'imovel'
      ? (item.property.height ?? 300) + 150
      : item.kind === 'empreendimento'
        ? (item.development.height ?? 300) + 170
        : item.kind === 'depoimento'
          ? 280
          : 320;
  const tamanhoDestaque = (i: FeedItem) => (i.kind === 'imovel' ? i.property.destaqueTamanho : i.kind === 'empreendimento' ? i.development.destaqueTamanho : 2) ?? 2;
  const grandes = destaques.filter((d) => tamanhoDestaque(d) === 3);
  const medios = destaques.filter((d) => tamanhoDestaque(d) !== 3);
  // monta a grade: itens normais + espaços de destaque no 3º lugar e a cada 20 itens.
  // Os espaços alternam entre GRANDE (2 colunas e 2 linhas) e 2 colunas, conforme houver.
  function montarGrade(): ItemGrade[] {
    const out: ItemGrade[] = [];
    let slot = 0;
    items.forEach((item, idx) => {
      if (destaques.length && (idx === 2 || (idx > 2 && (idx - 2) % 20 === 0))) {
        const s = slot++;
        const querGrande = s % 2 === 0;
        const pool = (querGrande && grandes.length) || !medios.length ? grandes : medios;
        const grande = pool === grandes;
        out.push({
          chave: `rot-${s}`,
          largo: true,
          alto: grande,
          estimativa: grande ? 820 : 420,
          node: <DestaqueRotativo pool={pool} inicio={s * 3} render={(it) => renderItem(it, 0, true, grande)} />
        });
      }
      const colunas = item.kind === 'destaque' ? item.destaque.colunas : 1;
      out.push({
        chave: chaveItem(item),
        largo: colunas >= 2,
        alto: colunas === 3,
        estimativa: colunas === 3 ? 820 : colunas === 2 ? 420 : estimar(item),
        node: renderItem(item, idx, false, colunas === 3)
      });
    });
    return out;
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-1 pt-5 md:px-8 md:pt-6">
        <div className="min-w-0 flex-1 text-[15px] font-bold">
          {filters.modo === 'lancamentos' ? 'Lançamentos e condomínios' : 'Imóveis para você'}
          {totalAVenda != null && (totalAVenda > 0 || filtrando) ? (
            <span className="ml-2 inline-flex translate-y-[-1px] items-center rounded-full bg-accent/10 px-2.5 py-0.5 align-middle text-xs font-bold text-accent">
              <span className="font-sans tabular-nums">{totalAVenda.toLocaleString('pt-BR')}</span>&nbsp;
              {totalAVenda === 1 ? 'imóvel' : 'imóveis'} {filters.finalidade === 'aluguel' ? 'para alugar' : 'à venda'}
              {filtrando ? ' nesta busca' : ''}
            </span>
          ) : null}
          {filters.locais.length ? (
            <span className="font-normal text-[var(--text-muted)]"> · em {filters.locais.map((l) => l.nome).join(', ')}</span>
          ) : null}
          {filters.termos.length ? (
            <span className="font-normal text-[var(--text-muted)]"> · busca por {filters.termos.map((t) => `“${t}”`).join(' ou ')}</span>
          ) : null}
        </div>
        <FeedModoToggle
          modo={modoFeed}
          jaEscolheu={escolheuFeed}
          onChange={(m) => {
            setModoFeed(m);
            setEscolheuFeed(true);
          }}
        />
      </div>

      {modoEquipe && (
        <p className="mx-4 mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 md:mx-8">
          <strong>Visão da equipe:</strong> você está logada no painel, então o feed mostra <strong>todos</strong> os condomínios. Visitantes só veem no
          feed os condomínios com foto; os demais aparecem quando pesquisam o nome.
        </p>
      )}

      <FeedGrid modo={modoFeed} itens={montarGrade()} />

      {items.length === 0 && !loading && (
        <div className="px-4 pb-16 text-center text-sm text-[var(--text-muted)]">
          Nenhum resultado com esses filtros. Tente ajustar algum deles ou limpar a busca.
        </div>
      )}

      <div ref={sentinelRef} className="h-px" />
      {loading && (
        // esqueletos enquanto a próxima leva chega (a tela não parece travada)
        <div className="grid grid-cols-2 gap-x-2.5 px-2.5 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] sm:gap-x-3 sm:px-5 md:gap-x-4 md:px-6" aria-hidden>
          {Array.from({ length: 6 }).map((_, k) => (
            <div key={k} className={`mb-6 ${k > 1 ? 'hidden sm:block' : ''}`}>
              <div className="esqueleto rounded-2xl" style={{ height: [260, 320, 280, 340, 300, 270][k] }} />
              <div className="esqueleto mt-2.5 h-3 w-2/3 rounded-full" />
              <div className="esqueleto mt-2 h-4 w-1/2 rounded-full" />
            </div>
          ))}
        </div>
      )}
      <div className="px-4 pb-12 text-center text-[13px] text-[var(--text-faint)]">
        {done && items.length > 0 && 'Você viu todos os imóveis desta busca.'}
      </div>

      {done && ocultos.length > 0 && (
        <section className="mx-auto mb-16 w-full max-w-6xl px-4 md:px-8" aria-label="Anúncios reservados">
          <h2 className="text-lg font-bold">Anúncios reservados que podem atender sua busca</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Imóveis do nosso portfólio que o proprietário preferiu não publicar abertamente. Mostramos só as características. Peça para ver o anúncio
            completo e verificamos a disponibilidade para você.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {ocultos.map((a) => (
              <OcultoCard key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      {(done || (items.length === 0 && !loading)) && condosBairro.length > 0 && (
        <section className="mx-auto mb-16 w-full max-w-6xl px-4 md:px-8" aria-label="Condomínios neste bairro">
          <h2 className="text-lg font-bold">
            Condomínios {filters.locais.filter((l) => l.tipo === 'bairro').length > 1 ? 'nestes bairros' : `no ${filters.locais.find((l) => l.tipo === 'bairro')?.nome}`}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Conheça os condomínios da região. Toque no nome para ver fotos, lazer e o que está à venda.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(verTodosCondos ? condosBairro : condosBairro.slice(0, 40)).map((c) => (
              <Link
                key={c.id}
                href={urlCondominio(c)}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
              >
                {c.nome}
                {c.anuncios > 0 && (
                  <span className="rounded-full bg-[#16A34A] px-1.5 text-[10px] font-bold text-white" title={`${c.anuncios} anúncio(s)`}>
                    {c.anuncios}
                  </span>
                )}
              </Link>
            ))}
            {!verTodosCondos && condosBairro.length > 40 && (
              <button
                type="button"
                onClick={() => setVerTodosCondos(true)}
                className="rounded-full bg-[var(--pill-bg)] px-3.5 py-1.5 text-sm font-bold hover:bg-[var(--border)]"
              >
                Ver todos ({condosBairro.length})
              </button>
            )}
          </div>
        </section>
      )}

      <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} onSignIn={handleSignIn} />
    </>
  );
}

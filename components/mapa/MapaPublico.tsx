'use client';

// Mapa para o visitante (versão combinada aprovada):
//  - computador: filtros (mesmo painel do feed) + lista "Nesta área do mapa" + mapa;
//    clicar num ponto ou num item da lista abre a gaveta à direita;
//  - celular: mapa em tela cheia, atalhos de filtro no topo e gaveta de baixo;
//  - os 3 primeiros cartões são livres; a partir do 4º, convite para entrar com o
//    Google (a equipe logada nunca vê o convite);
//  - busca só a área visível (o servidor aplica as regras de privacidade).
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import PainelFiltros from '@/components/PainelFiltros';
import SearchBox from '@/components/SearchBox';
import LoginModal from '@/components/LoginModal';
import GavetaMapa, { type CondoComImoveis, type Selecionado } from '@/components/mapa/GavetaMapa';
import type { AreaVisivel } from '@/components/mapa/MapaImoveis';
import { DEFAULT_FILTERS, addTermos, localKey, splitTermos, type FilterState, type LocalFiltro } from '@/lib/filters';
import { getPontosMapaPublico } from '@/lib/actions';
import { useSession } from '@/lib/use-session';
import { useStaffSession } from '@/lib/use-staff-session';
import { getStatusBucket, temEntrega, BUCKET_LABEL } from '@/lib/classification';
import { precoCurto, type PontoImovel, type PontoMapa } from '@/lib/mapa-tipos';

const MapaImoveis = dynamic(() => import('@/components/mapa/MapaImoveis'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-[13px] text-[var(--text-muted)]">Carregando o mapa…</div>
});

const CHAVE_FILTROS = 'mn_filtros_feed';
const CHAVE_ABERTOS = 'mn_mapa_abertos';
const LIVRES = 3;
const ACESAS = ['breve_lancamento', 'lancamento', 'obras', 'novo'];

const LEGENDA_PUBLICA: { cor: string; texto: string; borda?: string; ponto?: boolean }[] = [
  { cor: '#6A3CFF', texto: 'Breve lançamento' },
  { cor: '#257CFF', texto: 'Lançamento' },
  { cor: '#E08A00', texto: 'Obras' },
  { cor: '#1B5FCC', texto: 'Pronto novo' },
  { cor: '#13874B', texto: 'Com anúncio' },
  { cor: '#FFFFFF', borda: '#C9CDD3', texto: 'Anúncio (região aproximada)' },
  { cor: '#20242C', texto: 'Anúncio privado' },
  { cor: '#E62F2F', texto: 'Vendido nos últimos 30 dias' },
  { cor: '#A3A8AF', texto: 'Sem anúncio agora', ponto: true }
];

function agrupar(pontos: PontoMapa[]) {
  const condos = new Map<string, CondoComImoveis>();
  for (const p of pontos) if (p.tipo === 'condominio') condos.set(p.id, { ...p, imoveis: [] });
  const soltos: PontoImovel[] = [];
  for (const p of pontos) {
    if (p.tipo !== 'imovel') continue;
    const c = p.condominioId && !p.vendidoEm ? condos.get(p.condominioId) : undefined;
    if (c) c.imoveis.push(p);
    else soltos.push(p);
  }
  return { condos, soltos };
}

export default function MapaPublico() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [area, setArea] = useState<AreaVisivel | null>(null);
  const [pontos, setPontos] = useState<PontoMapa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);
  const [sel, setSel] = useState<Selecionado | null>(null);
  const [pedindoLogin, setPedindoLogin] = useState<Selecionado | null>(null);
  const [legenda, setLegenda] = useState(false);
  const pedido = useRef(0);
  const { session, signIn } = useSession();
  const { staff } = useStaffSession();
  const liberado = session.loggedIn || !!staff;

  // vindo do cartão "Localização" de uma página: /mapa?lat=..&lng=..&z=16&sel=c:ID
  const [centro, setCentro] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const pendente = useRef<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const lat = Number(q.get('lat'));
    const lng = Number(q.get('lng'));
    const z = Number(q.get('z'));
    const ok = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0);
    setCentro(ok ? { lat, lng, zoom: Number.isFinite(z) && z >= 3 && z <= 19 ? z : 16 } : { lat: -16.6869, lng: -49.2648, zoom: 12.5 });
    const sel = q.get('sel');
    if (sel && /^[ci]:[\w-]{1,80}$/.test(sel)) pendente.current = sel;
  }, []);

  // filtros compartilhados com o feed (mesma busca nos dois modos)
  useEffect(() => {
    try {
      const salvo = JSON.parse(sessionStorage.getItem(CHAVE_FILTROS) || 'null') as FilterState | null;
      const locais = JSON.parse(localStorage.getItem('mn_locais') || '[]') as LocalFiltro[];
      setFilters({ ...DEFAULT_FILTERS, ...(salvo ?? {}), locais: salvo?.locais ?? (Array.isArray(locais) ? locais.slice(0, 20) : []) });
    } catch {
      /* sem memória */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_FILTROS, JSON.stringify(filters));
      localStorage.setItem('mn_locais', JSON.stringify(filters.locais));
    } catch {
      /* ignora */
    }
  }, [filters]);

  // busca só a área visível (com folga de 25% em volta)
  useEffect(() => {
    if (!area) return;
    const n = ++pedido.current;
    setCarregando(true);
    const dx = (area.leste - area.oeste) * 0.25;
    const dy = (area.norte - area.sul) * 0.25;
    const t = setTimeout(() => {
      getPontosMapaPublico(filters, { oeste: area.oeste - dx, sul: area.sul - dy, leste: area.leste + dx, norte: area.norte + dy })
        .then((r) => {
          if (n !== pedido.current) return;
          setPontos(r.pontos);
          setBloqueado(!!r.bloqueado);
        })
        .catch(() => {})
        .finally(() => n === pedido.current && setCarregando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [filters, area]);

  const grupos = useMemo(() => agrupar(pontos), [pontos]);

  // lista "Nesta área do mapa": só o que está na tela, com anúncio e lançamentos primeiro
  const lista = useMemo(() => {
    if (!area) return [] as Selecionado[];
    const dentro = (lat: number, lng: number) => lat >= area.sul && lat <= area.norte && lng >= area.oeste && lng <= area.leste;
    const itens: { s: Selecionado; peso: number }[] = [];
    for (const c of Array.from(grupos.condos.values())) {
      if (!dentro(c.lat, c.lng)) continue;
      const fase = temEntrega(c.entrega) ? getStatusBucket(c.entrega) : null;
      const acesa = (fase && ACESAS.includes(fase)) || c.imoveis.length > 0;
      if (!acesa) continue;
      itens.push({ s: { tipo: 'condominio', c }, peso: c.imoveis.length ? 0 : fase === 'lancamento' || fase === 'breve_lancamento' ? 1 : 2 });
    }
    for (const i of grupos.soltos) if (dentro(i.lat, i.lng)) itens.push({ s: { tipo: 'imovel', i }, peso: i.vendidoEm ? 4 : i.privado ? 3 : 0 });
    return itens.sort((a, b) => a.peso - b.peso).map((x) => x.s);
  }, [grupos, area]);

  const abrir = useCallback(
    (s: Selecionado) => {
      if (!liberado) {
        let n = 0;
        try {
          const ids = JSON.parse(localStorage.getItem(CHAVE_ABERTOS) || '[]') as string[];
          const id = s.tipo === 'condominio' ? s.c.id : s.i.id;
          const novos = ids.includes(id) ? ids : [...ids, id].slice(-50);
          localStorage.setItem(CHAVE_ABERTOS, JSON.stringify(novos));
          n = novos.length;
        } catch {
          n = 0;
        }
        if (n > LIVRES) return setPedindoLogin(s);
      }
      setSel(s);
    },
    [liberado]
  );
  const selecionar = useCallback(
    ({ tipo, id }: { tipo: 'imovel' | 'condominio'; id: string }) => {
      if (tipo === 'condominio') {
        const c = grupos.condos.get(id);
        if (c) abrir({ tipo: 'condominio', c });
      } else {
        const i = grupos.soltos.find((x) => x.id === id);
        if (i) abrir({ tipo: 'imovel', i });
      }
    },
    [grupos, abrir]
  );

  // abre o ponto pedido no endereço assim que ele chega (anúncio dentro de condomínio abre o condomínio)
  useEffect(() => {
    const p = pendente.current;
    if (!p || !pontos.length) return;
    const id = p.slice(2);
    if (p.startsWith('c:')) {
      const c = grupos.condos.get(id);
      if (c) {
        pendente.current = null;
        abrir({ tipo: 'condominio', c });
      }
      return;
    }
    const solto = grupos.soltos.find((x) => x.id === id);
    if (solto) {
      pendente.current = null;
      return abrir({ tipo: 'imovel', i: solto });
    }
    const dono = Array.from(grupos.condos.values()).find((c) => c.imoveis.some((x) => x.id === id));
    if (dono) {
      pendente.current = null;
      abrir({ tipo: 'condominio', c: dono });
    }
  }, [pontos, grupos, abrir]);

  const toggleLocal = (l: LocalFiltro) =>
    setFilters((prev) => {
      const k = localKey(l);
      const tem = prev.locais.some((x) => localKey(x) === k);
      return { ...prev, locais: tem ? prev.locais.filter((x) => localKey(x) !== k) : [...prev.locais, l] };
    });

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <Header
        searchSlot={
          <SearchBox
            locais={filters.locais}
            onToggleLocal={toggleLocal}
            onSearchText={(texto) => setFilters((prev) => ({ ...prev, termos: addTermos(prev.termos, splitTermos(texto)) }))}
          />
        }
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="flex min-h-0 flex-1 [&_aside.sticky]:h-full">
        <PainelFiltros filters={filters} onChange={setFilters} />

        {/* lista da área (computador) */}
        <section aria-label="Nesta área do mapa" className="hidden w-[340px] shrink-0 flex-col border-r border-[var(--border)] lg:flex">
          <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
            <h1 className="text-[16px] font-bold">Nesta área do mapa</h1>
            <span className="text-[12.5px] text-[var(--text-muted)]">{carregando ? 'Atualizando…' : `${lista.length} resultado${lista.length === 1 ? '' : 's'}`}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {lista.length === 0 && !carregando && <p className="mt-6 text-[13.5px] text-[var(--text-muted)]">Nada com esses filtros nesta área. Afaste o mapa ou mude os filtros.</p>}
            <div className="flex flex-col gap-2.5">
              {lista.slice(0, 60).map((s) => {
                const c = s.tipo === 'condominio' ? s.c : null;
                const i = s.tipo === 'imovel' ? s.i : null;
                const fase = c && temEntrega(c.entrega) ? getStatusBucket(c.entrega) : null;
                const titulo = c ? c.nome : i!.nome;
                const preco = c
                  ? c.imoveis.length
                    ? `${c.imoveis.length} anúncio${c.imoveis.length > 1 ? 's' : ''}${c.imoveis.some((x) => x.preco) ? ` · desde ${precoCurto(Math.min(...c.imoveis.filter((x) => x.preco).map((x) => x.preco!)))}` : ''}`
                    : c.preco
                      ? `A partir de ${precoCurto(c.preco)}`
                      : fase
                        ? BUCKET_LABEL[fase]
                        : ''
                  : i!.vendidoEm
                    ? 'Vendido'
                    : i!.privado
                      ? `Privado${i!.preco ? ` · ${precoCurto(i!.preco)}` : ''}`
                      : precoCurto(i!.preco) || 'Consulte';
                const capa = c ? c.capa : i!.capa;
                return (
                  <button
                    key={`${s.tipo}:${c ? c.id : i!.id}`}
                    type="button"
                    onClick={() => abrir(s)}
                    className="flex w-full gap-3 rounded-2xl border border-[var(--border)] p-2 text-left hover:border-accent"
                  >
                    <span className="h-[72px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-[#DDE1E6]">
                      {capa && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={capa} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold">{titulo}</span>
                      <span className="block truncate text-[12px] text-[var(--text-muted)]">{[c?.bairro ?? i?.bairro, fase ? BUCKET_LABEL[fase] : null].filter(Boolean).join(' · ')}</span>
                      <span className={`mt-1 block text-[13.5px] font-bold tabular-nums ${i?.vendidoEm ? 'text-[#E62F2F]' : ''}`}>{preco}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="relative min-w-0 flex-1">
          {centro && <MapaImoveis pontos={pontos} onSelecionar={selecionar} onArea={setArea} enquadrar={false} centroInicial={centro} />}

          {bloqueado && (
            <div className="absolute inset-x-3 top-3 z-20 mx-auto max-w-md rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900 shadow">
              Muitas consultas em pouco tempo. Aguarde alguns minutos e mova o mapa de novo.
            </div>
          )}

          <div className="absolute bottom-6 left-3 z-10 md:bottom-8">
            {legenda ? (
              <div className="rounded-2xl bg-[var(--bg)] p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="text-[12px] font-bold uppercase tracking-wide">Legenda</span>
                  <button type="button" onClick={() => setLegenda(false)} className="text-[12px] font-semibold text-[var(--text-muted)]">
                    Fechar
                  </button>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {LEGENDA_PUBLICA.map((l) => (
                    <li key={l.texto} className="flex items-center gap-2 text-[12.5px]">
                      <span className={l.ponto ? 'h-2.5 w-2.5 rounded-full' : 'h-3.5 w-6 rounded-md'} style={{ background: l.cor, border: `1px solid ${l.borda ?? l.cor}` }} />
                      {l.texto}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <button type="button" onClick={() => setLegenda(true)} className="rounded-full bg-[var(--bg)] px-3.5 py-2 text-[12.5px] font-semibold shadow-lg">
                Legenda
              </button>
            )}
          </div>

          <Link
            href="/"
            className="absolute bottom-6 left-1/2 z-10 flex h-11 -translate-x-1/2 items-center rounded-full bg-[#14161A] px-5 text-[13.5px] font-semibold text-white shadow-lg lg:hidden"
          >
            Ver em lista
          </Link>

          {sel && <GavetaMapa sel={sel} onFechar={() => setSel(null)} />}
        </div>
      </div>

      <LoginModal
        open={!!pedindoLogin}
        onClose={() => setPedindoLogin(null)}
        titulo="Continue explorando o mapa"
        texto="Você já viu 3 imóveis. Entre com o Google, sem senha e em um toque, para ver todos, a posição do sol de cada prédio e receber avisos da área."
        onSignIn={(c) => {
          signIn(c);
          const s = pedindoLogin;
          setPedindoLogin(null);
          if (s) setSel(s);
        }}
      />
    </div>
  );
}

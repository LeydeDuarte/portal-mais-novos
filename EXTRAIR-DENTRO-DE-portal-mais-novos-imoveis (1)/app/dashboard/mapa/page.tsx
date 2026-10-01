'use client';

// Mapa do painel: todos os anúncios (inclusive privados) e condomínios, com os
// MESMOS filtros do feed (barra do topo e lateral esquerda). Ferramentas do Google
// (busca de endereço e localização automática) só aparecem se a chave estiver
// configurada; sem ela, o mapa funciona igual.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import FilterBar from '@/components/FilterBar';
import PainelFiltros from '@/components/PainelFiltros';
import { LEGENDA, type Foco } from '@/components/mapa/MapaImoveis';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { DEFAULT_FILTERS, type FilterState } from '@/lib/filters';
import { getPontosMapa, salvarPosicaoMapa } from '@/lib/actions';
import {
  buscarLugares,
  googleDisponivel,
  localizarCondominios,
  posicaoDoLugar,
  statusLocalizacao,
  tentarFalhasDeNovo,
  type StatusLocalizacao,
  type SugestaoLugar
} from '@/lib/actions-mapa';
import type { PontoMapa } from '@/lib/mapa-tipos';

const MapaImoveis = dynamic(() => import('@/components/mapa/MapaImoveis'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-[13px] text-[var(--text-muted)]">Carregando o mapa…</div>
});

const novaSessao = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()));

function BuscaEndereco({ onEscolher }: { onEscolher: (f: Foco) => void }) {
  const [texto, setTexto] = useState('');
  const [itens, setItens] = useState<SugestaoLugar[]>([]);
  const [aberto, setAberto] = useState(false);
  const sessao = useRef(novaSessao());
  useEffect(() => {
    if (texto.trim().length < 3) {
      setItens([]);
      return;
    }
    const t = setTimeout(() => {
      buscarLugares(texto, sessao.current)
        .then((r) => {
          setItens(r);
          setAberto(true);
        })
        .catch(() => setItens([]));
    }, 350);
    return () => clearTimeout(t);
  }, [texto]);
  const escolher = async (s: SugestaoLugar) => {
    setAberto(false);
    setTexto(s.principal);
    const pos = await posicaoDoLugar(s.placeId, sessao.current).catch(() => null);
    sessao.current = novaSessao(); // cada busca concluída fecha uma sessão do Google
    if (pos) onEscolher({ lat: pos.lat, lng: pos.lng, texto: pos.endereco || s.principal, ts: Date.now() });
  };
  return (
    <div className="relative w-full md:w-[340px]">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => itens.length && setAberto(true)}
        onKeyDown={(e) => e.key === 'Enter' && itens[0] && escolher(itens[0])}
        placeholder="Buscar endereço, prédio ou lugar (Google)"
        className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-[13.5px] shadow-lg outline-none focus:border-accent"
      />
      {aberto && itens.length > 0 && (
        <div className="absolute inset-x-0 top-12 z-20 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl">
          {itens.map((s) => (
            <button key={s.placeId} type="button" onClick={() => escolher(s)} className="block w-full px-4 py-2.5 text-left hover:bg-[var(--pill-bg)]">
              <span className="block text-[13.5px] font-semibold">{s.principal}</span>
              {s.secundario && <span className="block text-[12px] text-[var(--text-muted)]">{s.secundario}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Localizador({ aoTerminarLote }: { aoTerminarLote: () => void }) {
  const [st, setSt] = useState<StatusLocalizacao | null>(null);
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(true);
  const parar = useRef(false);
  const atualizar = () => statusLocalizacao().then(setSt).catch(() => {});
  useEffect(() => {
    atualizar();
    try {
      if (localStorage.getItem('mn_localizador') === 'recolhido') setAberto(false);
    } catch {
      /* sem armazenamento */
    }
  }, []);
  const alternar = (v: boolean) => {
    setAberto(v);
    try {
      localStorage.setItem('mn_localizador', v ? 'aberto' : 'recolhido');
    } catch {
      /* ignora */
    }
  };
  const rodar = async () => {
    parar.current = false;
    setRodando(true);
    setMsg(null);
    setAviso(null);
    const soma = { ok: 0, aprox: 0, falhou: 0 };
    let lotes = 0;
    try {
      for (;;) {
        const r = await localizarCondominios();
        soma.ok += r.ok;
        soma.aprox += r.aproximados;
        soma.falhou += r.falharam;
        setMsg(`${soma.ok} localizados · ${soma.aprox} aproximados · ${soma.falhou} não encontrados`);
        if (r.erro) {
          setAviso(r.erro);
          break;
        }
        if (!r.restantes || !r.feitos || parar.current) break;
        // atualiza o mapa a cada 3 lotes, para ver os pontos aparecendo
        if (++lotes % 3 === 0) aoTerminarLote();
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Falha ao localizar.');
    } finally {
      setRodando(false);
      atualizar();
      aoTerminarLote();
    }
  };
  if (!st || (!st.pendentes && !st.falharam && !msg)) return null;

  // recolhido: só uma pílula pequena com o número que falta
  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => alternar(true)}
        className="flex h-9 items-center gap-2 rounded-full bg-[var(--bg)] px-3.5 text-[12.5px] font-semibold shadow-lg"
        title="Abrir o quadro de localização"
      >
        <span className={`h-2 w-2 rounded-full ${aviso ? 'bg-amber-500' : rodando ? 'animate-pulse bg-accent' : 'bg-[var(--text-faint)]'}`} />
        {rodando ? 'Localizando…' : `${st.pendentes} sem posição`}
        <span aria-hidden>›</span>
      </button>
    );

  return (
    <div className="w-full rounded-2xl bg-[var(--bg)] p-3 text-[12.5px] shadow-lg md:w-[340px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold">Condomínios sem posição no mapa</div>
          <div className="mt-0.5 text-[var(--text-muted)]">
            {st.pendentes} na fila{st.falharam ? ` · ${st.falharam} não encontrados` : ''} · {st.localizados} no mapa
          </div>
        </div>
        <button
          type="button"
          onClick={() => alternar(false)}
          aria-label="Recolher o quadro"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[16px] text-[var(--text-muted)] hover:bg-[var(--pill-bg)]"
        >
          –
        </button>
      </div>
      {msg && <div className="mt-2">{msg}</div>}
      {aviso && <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">{aviso}</div>}
      <div className="mt-2 flex flex-wrap gap-2">
        {rodando ? (
          <button type="button" onClick={() => (parar.current = true)} className="h-9 rounded-full border border-[var(--border)] px-3.5 font-semibold">
            Parar
          </button>
        ) : (
          st.pendentes > 0 && (
            <button type="button" onClick={rodar} className="h-9 rounded-full bg-accent px-3.5 font-bold text-white">
              Localizar com o Google
            </button>
          )
        )}
        {!rodando && st.falharam > 0 && (
          <button
            type="button"
            onClick={() => tentarFalhasDeNovo().then(atualizar)}
            className="h-9 rounded-full border border-[var(--border)] px-3.5 font-semibold"
            title="Use depois de corrigir os endereços desses condomínios"
          >
            Tentar os não encontrados de novo
          </button>
        )}
      </div>
    </div>
  );
}

export default function MapaPainelPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pontos, setPontos] = useState<PontoMapa[]>([]);
  const [semPosicao, setSemPosicao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [google, setGoogle] = useState(false);
  const [foco, setFoco] = useState<Foco | null>(null);
  const [legenda, setLegenda] = useState(false);
  const pedido = useRef(0);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff) googleDisponivel().then(setGoogle).catch(() => setGoogle(false));
  }, [staff]);

  const carregar = useCallback(() => {
    const n = ++pedido.current;
    setCarregando(true);
    getPontosMapa(filters)
      .then((r) => {
        if (n !== pedido.current) return;
        setPontos(r.pontos);
        setSemPosicao(r.semPosicao);
        setErro(null);
      })
      .catch((e) => n === pedido.current && setErro(e instanceof Error ? e.message : 'Falha ao carregar o mapa.'))
      .finally(() => n === pedido.current && setCarregando(false));
  }, [filters]);

  useEffect(() => {
    if (!staff) return;
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [staff, carregar]);

  const mover = useCallback(
    async (tipo: 'imovel' | 'condominio', id: string, lat: number, lng: number) => {
      await salvarPosicaoMapa(tipo, id, lat, lng);
      carregar();
    },
    [carregar]
  );

  if (!staff) return null;
  const nCondos = pontos.filter((p) => p.tipo === 'condominio').length;
  const nImoveis = pontos.length - nCondos;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <PainelNav />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="flex min-h-0 flex-1 [&_aside]:h-full">
        <PainelFiltros filters={filters} onChange={setFilters} />
        <div className="relative min-w-0 flex-1">
          <MapaImoveis pontos={pontos} foco={foco} onMover={mover} />

          <div className="pointer-events-none absolute left-3 right-14 top-3 z-10 flex flex-col gap-2 md:right-auto">
            <div className="pointer-events-auto">{google && <BuscaEndereco onEscolher={setFoco} />}</div>
            <div className="pointer-events-auto w-fit rounded-full bg-[var(--bg)] px-3.5 py-1.5 text-[12.5px] font-semibold shadow-lg">
              {carregando ? 'Atualizando…' : `${nCondos.toLocaleString('pt-BR')} condomínios · ${nImoveis.toLocaleString('pt-BR')} anúncios`}
              {!carregando && semPosicao > 0 && <span className="font-normal text-[var(--text-muted)]"> · {semPosicao} sem posição</span>}
            </div>
            {erro && <div className="pointer-events-auto rounded-xl bg-red-50 p-2.5 text-[12.5px] text-red-700 shadow">{erro}</div>}
            {google && veTudo(staff.role) && (
              <div className="pointer-events-auto">
                <Localizador aoTerminarLote={carregar} />
              </div>
            )}
          </div>

          <div className="absolute bottom-8 left-3 z-10">
            {legenda ? (
              <div className="rounded-2xl bg-[var(--bg)] p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="text-[12px] font-bold uppercase tracking-wide">Legenda</span>
                  <button type="button" onClick={() => setLegenda(false)} className="text-[12px] font-semibold text-[var(--text-muted)]">
                    Fechar
                  </button>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {LEGENDA.map((l) => (
                    <li key={l.texto} className="flex items-center gap-2 text-[12.5px]">
                      <span
                        className={l.ponto ? 'h-2.5 w-2.5 rounded-full' : 'h-3.5 w-6 rounded-md'}
                        style={{ background: l.cor, border: `1px solid ${l.borda ?? l.cor}` }}
                      />
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
        </div>
      </div>
    </div>
  );
}

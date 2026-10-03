'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { getMercado, getMercadoMensal, getOscilacao, listHistorico, type MercadoBairro, type MercadoMes, type HistoricoLinha, type OscilacaoBairro } from '@/lib/actions';
import { panoramaEstoque, panoramaLancamentos, rankingIncorporadoras, type LinhaEstoque, type PanoramaEstoque, type PanoramaLancamentos, type RankingIncorporadora } from '@/lib/actions-tabelas';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';

const COR_ANUNCIOS = '#257CFF';
const COR_VENDIDOS = '#E8590C';
const COR_PORTAIS = '#6A3CFF';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const INICIO = '1990-01'; // "todo o histórico"
const mesLabel = (m: string) => {
  if (m === INICIO) return 'o início';
  const [a, mm] = m.split('-');
  return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mm) - 1]}/${a.slice(2)}`;
};

// Gráfico de linha simples (1 eixo: R$/m²) — anúncios (linha azul) e vendidos (pontos laranja)
function GraficoM2({ dados }: { dados: MercadoMes[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 260;
  const m = { t: 16, r: 16, b: 32, l: 72 };
  const valores = dados.flatMap((d) => [d.m2Anuncios, d.m2Vendidos, d.m2Portais]).filter((v): v is number => v != null);
  if (!valores.length) return <p className="text-sm text-[var(--text-muted)]">Sem dados de preço e metragem para este bairro ainda.</p>;
  const min = Math.min(...valores) * 0.9;
  const max = Math.max(...valores) * 1.05;
  const x = (i: number) => m.l + (dados.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (dados.length - 1));
  const y = (v: number) => m.t + (1 - (v - min) / (max - min || 1)) * (H - m.t - m.b);
  const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3);
  const linha = dados
    .map((d, i) => (d.m2Anuncios != null ? `${x(i)},${y(d.m2Anuncios)}` : null))
    .filter(Boolean)
    .join(' ');
  const linhaPortais = dados
    .map((d, i) => (d.m2Portais != null ? `${x(i)},${y(d.m2Portais)}` : null))
    .filter(Boolean)
    .join(' ');
  const passo = Math.max(1, Math.ceil(dados.length / 8));
  const h = hover != null ? dados[hover] : null;

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: COR_ANUNCIOS }} /> Média do m² anunciado</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_VENDIDOS }} /> Média do m² vendido</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: COR_PORTAIS }} /> Média do m² nos portais</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução do preço médio do metro quadrado por mês" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
              {brl(t)}
            </text>
          </g>
        ))}
        {dados.map((d, i) =>
          i % passo === 0 ? (
            <text key={d.mes} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
              {mesLabel(d.mes)}
            </text>
          ) : null
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} stroke="var(--text-faint)" strokeDasharray="3 3" />}
        <polyline points={linha} fill="none" stroke={COR_ANUNCIOS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={linhaPortais} fill="none" stroke={COR_PORTAIS} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
        {dados.map((d, i) =>
          d.m2Portais != null ? <circle key={`p${i}`} cx={x(i)} cy={y(d.m2Portais)} r={hover === i ? 5 : 3.5} fill={COR_PORTAIS} stroke="var(--bg)" strokeWidth={2} /> : null
        )}
        {dados.map((d, i) =>
          d.m2Anuncios != null ? <circle key={`a${i}`} cx={x(i)} cy={y(d.m2Anuncios)} r={hover === i ? 5 : 3.5} fill={COR_ANUNCIOS} stroke="var(--bg)" strokeWidth={2} /> : null
        )}
        {dados.map((d, i) =>
          d.m2Vendidos != null ? <circle key={`v${i}`} cx={x(i)} cy={y(d.m2Vendidos)} r={hover === i ? 6 : 4.5} fill={COR_VENDIDOS} stroke="var(--bg)" strokeWidth={2} /> : null
        )}
        {dados.map((d, i) => (
          <rect
            key={`h${i}`}
            x={x(i) - (W - m.l - m.r) / Math.max(dados.length, 1) / 2}
            y={m.t}
            width={(W - m.l - m.r) / Math.max(dados.length, 1)}
            height={H - m.t - m.b}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {h && (
        <div className="pointer-events-none absolute right-2 top-8 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-xs shadow-lg">
          <div className="font-bold">{mesLabel(h.mes)}</div>
          <div>Anunciado: {h.m2Anuncios != null ? `${brl(h.m2Anuncios)}/m² (${h.nAnuncios})` : '-'}</div>
          <div>Vendido: {h.m2Vendidos != null ? `${brl(h.m2Vendidos)}/m² (${h.nVendidos})` : '-'}</div>
          <div>Portais: {h.m2Portais != null ? `${brl(h.m2Portais)}/m² (${h.nPortais})` : '-'}</div>
        </div>
      )}
    </div>
  );
}

export default function MercadoPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [tipos, setTipos] = useState<TipoUnidade[]>([]);
  const [bairros, setBairros] = useState<MercadoBairro[] | null>(null);
  const [sel, setSel] = useState<MercadoBairro | null>(null);
  const [mensal, setMensal] = useState<MercadoMes[] | null>(null);
  const [historico, setHistorico] = useState<HistoricoLinha[]>([]);
  const [aba, setAba] = useState<'bairros' | 'oscilacao' | 'lancamentos' | 'estoque' | 'historico'>('bairros');
  const [estoque, setEstoque] = useState<PanoramaEstoque | null>(null);
  const [ranking, setRanking] = useState<RankingIncorporadora[] | null>(null);
  const [rankAberto, setRankAberto] = useState<string | null>(null);
  const [visaoEstoque, setVisaoEstoque] = useState<'empreendimentos' | 'bairros' | 'incorporadoras'>('empreendimentos');
  const [lanc, setLanc] = useState<PanoramaLancamentos | null>(null);
  // oscilação: compara o m² de cada bairro entre dois meses
  const meses = useMemo(() => {
    const l: string[] = [];
    const d = new Date();
    for (let i = 0; i < 121; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      l.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
    }
    return l;
  }, []);
  const [de, setDe] = useState(() => meses[Math.min(12, meses.length - 1)]);
  const [ate, setAte] = useState(() => meses[0]);
  const [osc, setOsc] = useState<OscilacaoBairro[] | null>(null);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);

  useEffect(() => {
    if (!staff) return;
    setBairros(null);
    getMercado(tipos).then((b) => {
      setBairros(b);
      setSel((s) => b.find((x) => s && x.bairro === s.bairro && x.cidade === s.cidade) ?? b[0] ?? null);
    });
  }, [staff, tipos]);

  useEffect(() => {
    if (staff) listHistorico().then(setHistorico).catch(() => {});
  }, [staff]);

  useEffect(() => {
    if (!sel) return setMensal(null);
    setMensal(null);
    getMercadoMensal(sel.bairro, sel.cidade, tipos).then(setMensal);
  }, [sel, tipos]);

  const totais = useMemo(() => (bairros ?? []).reduce((a, b) => ({ at: a.at + b.ativos, pv: a.pv + b.privados, vd: a.vd + b.vendidos, ex: a.ex + b.excluidos }), { at: 0, pv: 0, vd: 0, ex: 0 }), [bairros]);

  if (!loaded || !staff) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Mercado</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Anúncios de venda ativos (públicos e privados) + histórico de vendidos e excluídos. Uso interno, base para o preço médio do m² por bairro.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Ativos públicos', totais.at],
            ['Privados', totais.pv],
            ['Vendidos', totais.vd],
            ['Excluídos', totais.ex]
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-[var(--border)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{k}</div>
              <div className="font-sans text-2xl font-bold tabular-nums">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <select
            className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            value={tipos[0] ?? ''}
            onChange={(e) => setTipos(e.target.value ? [e.target.value as TipoUnidade] : [])}
          >
            <option value="">Todos os tipos</option>
            {TIPO_UNIDADE_GRUPOS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.tipos.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_UNIDADE_LABEL[t]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {(['bairros', 'oscilacao', 'lancamentos', 'estoque', 'historico'] as const).map((a) => (
            <button key={a} type="button" onClick={() => setAba(a)} className={`rounded-full px-4 py-2 text-sm font-bold ${aba === a ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}>
              {a === 'bairros' ? 'Por bairro' : a === 'oscilacao' ? 'Oscilação' : a === 'lancamentos' ? 'Lançamentos e obras' : a === 'estoque' ? 'Estoque e vendas' : `Histórico (${historico.length})`}
            </button>
          ))}
        </div>

        {aba === 'bairros' && (
          <>
            {sel && (
              <section className="mt-5 rounded-2xl border border-[var(--border)] p-4">
                <h2 className="text-base font-bold">
                  Preço médio do m², {sel.bairro}, {sel.cidade}
                </h2>
                <div className="mt-3">{mensal ? <GraficoM2 dados={mensal} /> : <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}</div>
              </section>
            )}

            <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--pill-bg)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2">Bairro</th>
                    <th className="px-3 py-2 text-right">Ativos</th>
                    <th className="px-3 py-2 text-right">Privados</th>
                    <th className="px-3 py-2 text-right">Vendidos</th>
                    <th className="px-3 py-2 text-right">Excluídos</th>
                    <th className="px-3 py-2 text-right">m² anunciado</th>
                    <th className="px-3 py-2 text-right">m² vendido</th>
                    <th className="px-3 py-2 text-right">m² portais (90 dias)</th>
                  </tr>
                </thead>
                <tbody>
                  {bairros === null && (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-[var(--text-muted)]">Carregando…</td>
                    </tr>
                  )}
                  {bairros?.map((b) => (
                    <tr
                      key={`${b.bairro}-${b.cidade}`}
                      onClick={() => setSel(b)}
                      className={`cursor-pointer border-t border-[var(--border)] tabular-nums hover:bg-[var(--pill-bg)] ${sel === b ? 'bg-[#f5f8ff]' : ''}`}
                    >
                      <td className="px-3 py-2 font-semibold">
                        {b.bairro} <span className="font-normal text-[var(--text-muted)]">· {b.cidade}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{b.ativos}</td>
                      <td className="px-3 py-2 text-right">{b.privados}</td>
                      <td className="px-3 py-2 text-right">{b.vendidos}</td>
                      <td className="px-3 py-2 text-right">{b.excluidos}</td>
                      <td className="px-3 py-2 text-right">{b.m2Anuncios ? brl(b.m2Anuncios) : '-'}</td>
                      <td className="px-3 py-2 text-right">{b.m2Vendidos ? brl(b.m2Vendidos) : '-'}</td>
                      <td className="px-3 py-2 text-right">
                        {b.m2Portais ? (
                          <>
                            {brl(b.m2Portais)} <span className="text-xs text-[var(--text-muted)]">({b.nPortais})</span>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {aba === 'oscilacao' && (
          <section className="mt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex basis-full flex-wrap gap-1.5">
                {(
                  [
                    [12, 'Últimos 12 meses'],
                    [60, '5 anos'],
                    [120, '10 anos'],
                    [0, 'Todo o histórico']
                  ] as const
                ).map(([n, l]) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setAte(meses[0]);
                      setDe(n === 0 ? INICIO : meses[Math.min(n, meses.length - 1)]);
                    }}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${(n === 0 ? de === INICIO : de === meses[n]) && ate === meses[0] ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                De
                <select value={de} onChange={(e) => setDe(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm">
                  {[...meses, INICIO].map((m) => (
                    <option key={m} value={m}>
                      {m === INICIO ? 'Desde o início' : mesLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                Até
                <select value={ate} onChange={(e) => setAte(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm">
                  {meses.map((m) => (
                    <option key={m} value={m}>
                      {mesLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setOsc(null);
                  getOscilacao(de, ate, tipos).then(setOsc).catch(() => setOsc([]));
                }}
                className="h-10 rounded-full bg-ink px-5 text-sm font-bold text-white"
              >
                Comparar
              </button>
              <p className="basis-full text-xs text-[var(--text-muted)]">
                Média do m² pedido em cada mês, juntando os anúncios do portal e os anúncios dos portais encontrados nas avaliações. O histórico cresce a cada avaliação e nunca é apagado.
              </p>
            </div>
            {osc && (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--pill-bg)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-2">Bairro</th>
                      <th className="px-3 py-2 text-right">m² em {mesLabel(de)}</th>
                      <th className="px-3 py-2 text-right">m² em {mesLabel(ate)}</th>
                      <th className="px-3 py-2 text-right">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {osc.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-[var(--text-muted)]">Sem dados nesses meses.</td>
                      </tr>
                    )}
                    {osc.map((o) => (
                      <tr key={`${o.bairro}-${o.cidade}`} className="border-t border-[var(--border)] tabular-nums">
                        <td className="px-3 py-2 font-semibold">
                          {o.bairro} <span className="font-normal text-[var(--text-muted)]">· {o.cidade}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {o.m2De ? brl(o.m2De) : '-'} <span className="text-xs text-[var(--text-muted)]">({o.nDe})</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {o.m2Ate ? brl(o.m2Ate) : '-'} <span className="text-xs text-[var(--text-muted)]">({o.nAte})</span>
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${o.variacaoPct == null ? 'text-[var(--text-muted)]' : o.variacaoPct > 0 ? 'text-[#15803D]' : o.variacaoPct < 0 ? 'text-[#C2410C]' : ''}`}>
                          {o.variacaoPct == null ? '-' : `${o.variacaoPct > 0 ? '+' : ''}${o.variacaoPct.toLocaleString('pt-BR')}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {aba === 'lancamentos' && (
          <section className="mt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex basis-full flex-wrap gap-1.5">
                {(
                  [
                    [12, 'Últimos 12 meses'],
                    [60, '5 anos'],
                    [120, '10 anos'],
                    [0, 'Todo o histórico']
                  ] as const
                ).map(([n, l]) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setAte(meses[0]);
                      setDe(n === 0 ? INICIO : meses[Math.min(n, meses.length - 1)]);
                    }}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${(n === 0 ? de === INICIO : de === meses[n]) && ate === meses[0] ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                De
                <select value={de} onChange={(e) => setDe(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm">
                  {[...meses, INICIO].map((m) => (
                    <option key={m} value={m}>
                      {m === INICIO ? 'Desde o início' : mesLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                Até
                <select value={ate} onChange={(e) => setAte(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm">
                  {meses.map((m) => (
                    <option key={m} value={m}>
                      {mesLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setLanc(null);
                  panoramaLancamentos(de, ate).then(setLanc).catch(() => setLanc({ mensal: [], bairros: [], incorporadoras: [], reajustes: [] }));
                }}
                className="h-10 rounded-full bg-ink px-5 text-sm font-bold text-white"
              >
                Ver período
              </button>
              <p className="basis-full text-xs text-[var(--text-muted)]">
                Pelas tabelas de vendas das incorporadoras (Painel → Tabelas de preços), pelo mês de referência de cada tabela. Média do m² das unidades disponíveis.
              </p>
            </div>
            {lanc && (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] p-4 lg:col-span-2">
                  <h3 className="text-sm font-bold">m² médio das tabelas, mês a mês</h3>
                  {lanc.mensal.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhuma tabela nesse período.</p>
                  ) : (
                    <div className="mt-3 flex h-40 items-end gap-2 overflow-x-auto">
                      {(() => {
                        const max = Math.max(...lanc.mensal.map((x) => x.m2 ?? 0), 1);
                        return lanc.mensal.map((x) => (
                          <div key={x.mes} className="flex h-full min-w-[46px] flex-1 flex-col items-center justify-end gap-1" title={`${mesLabel(x.mes)}: ${x.m2 ? brl(x.m2) : '-'} (${x.tabelas} tabelas)`}>
                            <span className="text-[10.5px] font-bold tabular-nums">{x.m2 ? `${Math.round(x.m2 / 100) / 10}k` : '-'}</span>
                            <div className="w-full max-w-[40px] rounded-t bg-accent" style={{ height: `${Math.max(2, ((x.m2 ?? 0) / max) * 100)}%` }} />
                            <span className="whitespace-nowrap text-[10.5px] text-[var(--text-muted)]">{mesLabel(x.mes)}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
                {(
                  [
                    ['Por bairro (tabela mais recente de cada empreendimento)', lanc.bairros, 'Empreend.'],
                    ['Por incorporadora', lanc.incorporadoras, 'Empreend.']
                  ] as const
                ).map(([titulo, lista, col]) => (
                  <div key={titulo} className="overflow-hidden rounded-2xl border border-[var(--border)]">
                    <h3 className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-bold">{titulo}</h3>
                    {lista.length === 0 ? (
                      <p className="p-4 text-sm text-[var(--text-muted)]">Sem dados no período.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-[var(--text-muted)]">
                          <tr>
                            <th className="px-4 py-1.5">Nome</th>
                            <th className="px-2 py-1.5 text-right">{col}</th>
                            <th className="px-4 py-1.5 text-right">m² médio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lista.map((x) => (
                            <tr key={`${x.nome}-${x.sub ?? ''}`} className="border-t border-[var(--border)] tabular-nums">
                              <td className="px-4 py-1.5 font-semibold">{x.nome}</td>
                              <td className="px-2 py-1.5 text-right">{x.n}</td>
                              <td className="px-4 py-1.5 text-right">{x.m2 ? brl(x.m2) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
                <div className="overflow-x-auto rounded-2xl border border-[var(--border)] lg:col-span-2">
                  <h3 className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-bold">Reajuste por empreendimento (primeira x última tabela do período)</h3>
                  {lanc.reajustes.length === 0 ? (
                    <p className="p-4 text-sm text-[var(--text-muted)]">É preciso ter pelo menos duas tabelas do mesmo empreendimento no período.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-[var(--text-muted)]">
                        <tr>
                          <th className="px-4 py-1.5">Empreendimento</th>
                          <th className="px-2 py-1.5 text-right">Tabelas</th>
                          <th className="px-2 py-1.5 text-right">m² no início</th>
                          <th className="px-2 py-1.5 text-right">m² no fim</th>
                          <th className="px-4 py-1.5 text-right">Reajuste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lanc.reajustes.map((x) => (
                          <tr key={`${x.nome}-${x.sub ?? ''}`} className="border-t border-[var(--border)] tabular-nums">
                            <td className="px-4 py-1.5 font-semibold">
                              {x.nome} {x.sub && <span className="font-normal text-[var(--text-muted)]">· {x.sub}</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right">{x.n}</td>
                            <td className="px-2 py-1.5 text-right">{x.m2Inicio ? brl(x.m2Inicio) : '-'}</td>
                            <td className="px-2 py-1.5 text-right">{x.m2Fim ? brl(x.m2Fim) : '-'}</td>
                            <td className={`px-4 py-1.5 text-right font-bold ${x.variacaoPct == null ? '' : x.variacaoPct > 0 ? 'text-[#15803D]' : x.variacaoPct < 0 ? 'text-[#C2410C]' : ''}`}>
                              {x.variacaoPct == null ? '-' : `${x.variacaoPct > 0 ? '+' : ''}${x.variacaoPct.toLocaleString('pt-BR')}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {aba === 'estoque' && (
          <section className="mt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex basis-full flex-wrap gap-1.5">
                {(
                  [
                    [12, 'Últimos 12 meses'],
                    [60, '5 anos'],
                    [120, '10 anos'],
                    [0, 'Todo o histórico']
                  ] as const
                ).map(([n, l]) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setAte(meses[0]);
                      setDe(n === 0 ? INICIO : meses[Math.min(n, meses.length - 1)]);
                    }}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${(n === 0 ? de === INICIO : de === meses[n]) && ate === meses[0] ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                De
                <select value={de} onChange={(e) => setDe(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm">
                  {[...meses, INICIO].map((m) => (
                    <option key={m} value={m}>
                      {m === INICIO ? 'Desde o início' : mesLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                Até
                <select value={ate} onChange={(e) => setAte(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm">
                  {meses.map((m) => (
                    <option key={m} value={m}>
                      {mesLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setEstoque(null);
                  setRanking(null);
                  panoramaEstoque(de, ate).then(setEstoque).catch(() => setEstoque(null));
                  rankingIncorporadoras(de, ate).then(setRanking).catch(() => setRanking([]));
                }}
                className="h-10 rounded-full bg-ink px-5 text-sm font-bold text-white"
              >
                Ver período
              </button>
              <p className="basis-full text-xs text-[var(--text-muted)]">
                Pelas tabelas de vendas das incorporadoras. Estoque = unidades disponíveis na tabela mais recente de cada empreendimento até o fim do período. Vendida = unidade que estava disponível numa tabela e não está mais na seguinte.
              </p>
            </div>
            {estoque && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                  {(
                    [
                      ['Unidades em estoque', estoque.total.disponiveis.toLocaleString('pt-BR'), `${estoque.total.empreendimentos} empreendimento(s)`],
                      ['VGV em estoque', brl(estoque.total.vgvDisponivel), 'soma das disponíveis'],
                      ['Vendidas no período', estoque.total.vendidas.toLocaleString('pt-BR'), 'entre tabelas seguidas'],
                      ['Velocidade de vendas', estoque.total.velocidade != null ? `${estoque.total.velocidade.toLocaleString('pt-BR')}/mês` : '-', estoque.total.vsoPct != null ? `VSO de ${estoque.total.vsoPct.toLocaleString('pt-BR')}% ao mês` : 'VSO: precisa de 2 tabelas'],
                      ['Estoque dura', estoque.total.mesesEstoque != null ? `${estoque.total.mesesEstoque.toLocaleString('pt-BR')} meses` : '-', 'no ritmo atual']
                    ] as const
                  ).map(([t, v, sub]) => (
                    <div key={t} className="rounded-2xl border border-[var(--border)] p-4">
                      <div className="text-[12px] font-semibold text-[var(--text-muted)]">{t}</div>
                      <div className="text-[22px] font-bold leading-tight tabular-nums">{v}</div>
                      <div className="text-xs text-[var(--text-muted)]">{sub}</div>
                    </div>
                  ))}
                </div>
                {estoque.porMes.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-[var(--border)] p-4">
                    <h3 className="text-sm font-bold">Unidades vendidas por mês (pelas tabelas recebidas)</h3>
                    <div className="mt-3 flex h-36 items-end gap-2 overflow-x-auto">
                      {(() => {
                        const max = Math.max(1, ...estoque.porMes.map((x) => x.vendidas));
                        return estoque.porMes.map((x) => (
                          <div key={x.mes} className="flex h-full min-w-[46px] flex-1 flex-col items-center justify-end gap-1" title={`${mesLabel(x.mes)}: ${x.vendidas} vendidas`}>
                            <span className="text-[10.5px] font-bold tabular-nums">{x.vendidas}</span>
                            <div className="w-full max-w-[40px] rounded-t bg-[#13874B]" style={{ height: `${Math.max(2, (x.vendidas / max) * 100)}%` }} />
                            <span className="whitespace-nowrap text-[10.5px] text-[var(--text-muted)]">{mesLabel(x.mes)}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
                {ranking && (
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)]">
                    <h3 className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-bold">Quem mais eliminou estoque (lançamento + revenda)</h3>
                    {ranking.length === 0 ? (
                      <p className="p-4 text-sm text-[var(--text-muted)]">Sem fechamentos no período. Suba tabelas de lançamento e planilhas de estoque de revenda das incorporadoras.</p>
                    ) : (
                      <table className="w-full min-w-[820px] text-sm">
                        <thead className="text-left text-xs text-[var(--text-muted)]">
                          <tr>
                            <th className="px-4 py-1.5">#</th>
                            <th className="px-2 py-1.5">Incorporadora</th>
                            <th className="px-2 py-1.5 text-right">Vendidas lanç.</th>
                            <th className="px-2 py-1.5 text-right">Vendidas revenda</th>
                            <th className="px-2 py-1.5 text-right">VGV vendido</th>
                            <th className="px-2 py-1.5 text-right">Estoque início → fim</th>
                            <th className="px-4 py-1.5 text-right">Eliminou</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ranking.map((r, i) => (
                            <Fragment key={r.empresaId}>
                              <tr className="cursor-pointer border-t border-[var(--border)] tabular-nums hover:bg-[var(--pill-bg)]" onClick={() => setRankAberto(rankAberto === r.empresaId ? null : r.empresaId)}>
                                <td className="px-4 py-2 font-bold text-[var(--text-muted)]">{i + 1}</td>
                                <td className="px-2 py-2 font-semibold">
                                  <span className="mr-1 text-[var(--text-muted)]">{rankAberto === r.empresaId ? '▾' : '▸'}</span>
                                  {r.nome}
                                </td>
                                <td className="px-2 py-2 text-right">{r.vendidasLanc}</td>
                                <td className="px-2 py-2 text-right">{r.vendidasRev}</td>
                                <td className="px-2 py-2 text-right">{r.vgvVendido ? brl(r.vgvVendido) : '-'}</td>
                                <td className="px-2 py-2 text-right">
                                  {r.estoqueInicio} → {r.estoqueFim}
                                </td>
                                <td className="px-4 py-2 text-right font-bold text-[#15803D]">{r.eliminadoPct != null ? `${r.eliminadoPct.toLocaleString('pt-BR')}%` : '-'}</td>
                              </tr>
                              {rankAberto === r.empresaId && (
                                <tr className="bg-[var(--pill-bg)]/50">
                                  <td colSpan={7} className="px-4 py-2">
                                    <table className="w-full text-[12.5px]">
                                      <thead className="text-left text-[11px] text-[var(--text-muted)]">
                                        <tr>
                                          <th className="py-1">Mês</th>
                                          <th className="py-1 text-right">Estoque lançamento</th>
                                          <th className="py-1 text-right">Estoque revenda</th>
                                          <th className="py-1 text-right">Vendidas lançamento</th>
                                          <th className="py-1 text-right">Vendidas revenda</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.meses.map((m) => (
                                          <tr key={m.mes} className="border-t border-[var(--border)] tabular-nums">
                                            <td className="py-1">{mesLabel(m.mes)}</td>
                                            <td className="py-1 text-right">{m.estoqueLanc || '-'}</td>
                                            <td className="py-1 text-right">{m.estoqueRev || '-'}</td>
                                            <td className="py-1 text-right">{m.vendidasLanc || '-'}</td>
                                            <td className="py-1 text-right">{m.vendidasRev || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <p className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--text-muted)]">
                      Fechamento mensal gravado a cada tabela recebida. Eliminou = unidades vendidas no período sobre o estoque no início (o primeiro estoque conhecido de lançamento e de revenda). Só entram os empreendimentos ligados à incorporadora no cadastro.
                    </p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(
                    [
                      ['empreendimentos', 'Por empreendimento'],
                      ['bairros', 'Por bairro'],
                      ['incorporadoras', 'Por incorporadora']
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setVisaoEstoque(v)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${visaoEstoque === v ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border)]">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-[var(--pill-bg)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      <tr>
                        <th className="px-3 py-2">{visaoEstoque === 'empreendimentos' ? 'Empreendimento' : visaoEstoque === 'bairros' ? 'Bairro' : 'Incorporadora'}</th>
                        {visaoEstoque !== 'empreendimentos' && <th className="px-2 py-2 text-right">Empreend.</th>}
                        <th className="px-2 py-2 text-right">Estoque</th>
                        <th className="px-2 py-2 text-right">VGV em estoque</th>
                        <th className="px-2 py-2 text-right">Vendidas</th>
                        <th className="px-2 py-2 text-right">Por mês</th>
                        <th className="px-2 py-2 text-right">VSO</th>
                        <th className="px-3 py-2 text-right">Dura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(estoque[visaoEstoque] as LinhaEstoque[]).length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 text-[var(--text-muted)]">Nenhuma tabela ligada a empreendimento até esse mês.</td>
                        </tr>
                      )}
                      {(estoque[visaoEstoque] as LinhaEstoque[]).map((x) => (
                        <tr key={`${x.nome}-${x.sub ?? ''}`} className="border-t border-[var(--border)] tabular-nums">
                          <td className="px-3 py-2">
                            <span className="font-semibold">{x.nome}</span>
                            {x.sub && <span className="text-[var(--text-muted)]"> · {x.sub}</span>}
                            {visaoEstoque === 'empreendimentos' && x.ultimaTabela && <span className="block text-xs text-[var(--text-muted)]">tabela de {mesLabel(x.ultimaTabela)}</span>}
                          </td>
                          {visaoEstoque !== 'empreendimentos' && <td className="px-2 py-2 text-right">{x.empreendimentos}</td>}
                          <td className="px-2 py-2 text-right font-semibold">{x.disponiveis}</td>
                          <td className="px-2 py-2 text-right">{x.vgvDisponivel ? brl(x.vgvDisponivel) : '-'}</td>
                          <td className="px-2 py-2 text-right">{x.vendidas}</td>
                          <td className="px-2 py-2 text-right">{x.velocidade != null ? x.velocidade.toLocaleString('pt-BR') : '-'}</td>
                          <td className="px-2 py-2 text-right">{x.vsoPct != null ? `${x.vsoPct.toLocaleString('pt-BR')}%` : '-'}</td>
                          <td className="px-3 py-2 text-right">{x.mesesEstoque != null ? `${x.mesesEstoque.toLocaleString('pt-BR')} meses` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  VSO (vendas sobre oferta): quanto do estoque é vendido por mês. Para calcular vendas e VSO de um empreendimento são precisas pelo menos duas tabelas dele em meses diferentes.
                </p>
              </>
            )}
          </section>
        )}

        {aba === 'historico' && (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--pill-bg)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Imóvel</th>
                  <th className="px-3 py-2 text-right">Anunciado</th>
                  <th className="px-3 py-2 text-right">Vendido por</th>
                  <th className="px-3 py-2 text-right">Área</th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-[var(--text-muted)]">Nada no histórico ainda, aparece aqui o que for marcado como vendido ou excluído.</td>
                  </tr>
                )}
                {historico.map((h, i) => (
                  <tr key={i} className="border-t border-[var(--border)] tabular-nums">
                    <td className="px-3 py-2">{new Date(h.encerradoEm).toLocaleDateString('pt-BR')}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${h.motivo === 'vendido' ? 'bg-emerald-100 text-emerald-800' : 'bg-[var(--pill-bg)]'}`}>
                        {h.motivo === 'vendido' ? 'Vendido' : 'Excluído'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {TIPO_UNIDADE_LABEL[h.tipoUnidade as TipoUnidade] ?? h.tipoUnidade}
                      <span className="text-[var(--text-muted)]"> · {[h.condominio, h.bairro, h.cidade].filter(Boolean).join(', ')}</span>
                    </td>
                    <td className="px-3 py-2 text-right">{h.preco ? brl(h.preco) : '-'}</td>
                    <td className="px-3 py-2 text-right">{h.valorVenda ? brl(h.valorVenda) : '-'}</td>
                    <td className="px-3 py-2 text-right">{h.area ? `${h.area.toLocaleString('pt-BR')} m²` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

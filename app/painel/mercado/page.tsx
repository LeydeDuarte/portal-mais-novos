'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { getMercado, getMercadoMensal, listHistorico, type MercadoBairro, type MercadoMes, type HistoricoLinha } from '@/lib/actions';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';

const COR_ANUNCIOS = '#257CFF';
const COR_VENDIDOS = '#E8590C';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const mesLabel = (m: string) => {
  const [a, mm] = m.split('-');
  return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mm) - 1]}/${a.slice(2)}`;
};

// Gráfico de linha simples (1 eixo: R$/m²) — anúncios (linha azul) e vendidos (pontos laranja)
function GraficoM2({ dados }: { dados: MercadoMes[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 260;
  const m = { t: 16, r: 16, b: 32, l: 72 };
  const valores = dados.flatMap((d) => [d.m2Anuncios, d.m2Vendidos]).filter((v): v is number => v != null);
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
  const passo = Math.max(1, Math.ceil(dados.length / 8));
  const h = hover != null ? dados[hover] : null;

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: COR_ANUNCIOS }} /> Média do m² anunciado</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_VENDIDOS }} /> Média do m² vendido</span>
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
          <div>Anunciado: {h.m2Anuncios != null ? `${brl(h.m2Anuncios)}/m² (${h.nAnuncios})` : '—'}</div>
          <div>Vendido: {h.m2Vendidos != null ? `${brl(h.m2Vendidos)}/m² (${h.nVendidos})` : '—'}</div>
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
  const [aba, setAba] = useState<'bairros' | 'historico'>('bairros');

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
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
          Anúncios de venda ativos (públicos e privados) + histórico de vendidos e excluídos. Uso interno — base para o preço médio do m² por bairro.
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
          {(['bairros', 'historico'] as const).map((a) => (
            <button key={a} type="button" onClick={() => setAba(a)} className={`rounded-full px-4 py-2 text-sm font-bold ${aba === a ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}>
              {a === 'bairros' ? 'Por bairro' : `Histórico (${historico.length})`}
            </button>
          ))}
        </div>

        {aba === 'bairros' && (
          <>
            {sel && (
              <section className="mt-5 rounded-2xl border border-[var(--border)] p-4">
                <h2 className="text-base font-bold">
                  Preço médio do m² — {sel.bairro}, {sel.cidade}
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
                  </tr>
                </thead>
                <tbody>
                  {bairros === null && (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-[var(--text-muted)]">Carregando…</td>
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
                      <td className="px-3 py-2 text-right">{b.m2Anuncios ? brl(b.m2Anuncios) : '—'}</td>
                      <td className="px-3 py-2 text-right">{b.m2Vendidos ? brl(b.m2Vendidos) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
                    <td colSpan={6} className="px-3 py-4 text-[var(--text-muted)]">Nada no histórico ainda — aparece aqui o que for marcado como vendido ou excluído.</td>
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
                    <td className="px-3 py-2 text-right">{h.preco ? brl(h.preco) : '—'}</td>
                    <td className="px-3 py-2 text-right">{h.valorVenda ? brl(h.valorVenda) : '—'}</td>
                    <td className="px-3 py-2 text-right">{h.area ? `${h.area.toLocaleString('pt-BR')} m²` : '—'}</td>
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

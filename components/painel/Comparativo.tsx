'use client';

import { useEffect, useState } from 'react';
import { comparativo, type Agrupamento, type LinhaComparativo } from '@/lib/painel-dados';
import { baixarCsv, baixarXlsx } from '@/lib/exportar-planilha';

// Comparativo de resultados (só o administrador principal): gráfico do indicador
// escolhido por mês, trimestre, semestre ou ano, com a variação sobre o período anterior.
const AGRUPAR: [Agrupamento, string][] = [
  ['mes', 'Mês'],
  ['trimestre', 'Trimestre'],
  ['semestre', 'Semestre'],
  ['ano', 'Ano']
];
type Chave = 'acessos' | 'visitantes' | 'novos' | 'cliquesWhatsapp' | 'contatos' | 'ganhos' | 'valorGanho';
const INDICADORES: [Chave, string][] = [
  ['acessos', 'Acessos'],
  ['visitantes', 'Visitantes'],
  ['novos', 'Visitantes novos'],
  ['cliquesWhatsapp', 'Cliques no WhatsApp'],
  ['contatos', 'Contatos (leads)'],
  ['ganhos', 'Negócios ganhos'],
  ['valorGanho', 'Valor ganho']
];
const num = (v: number) => v.toLocaleString('pt-BR');
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmt = (k: Chave, v: number) => (k === 'valorGanho' ? brl(v) : num(v));

function Variacao({ atual, anterior }: { atual: number; anterior: number | undefined }) {
  if (anterior == null) return <span className="text-[var(--text-muted)]">–</span>;
  if (anterior === 0) return <span className="text-[var(--text-muted)]">{atual ? 'novo' : '–'}</span>;
  const p = Math.round(((atual - anterior) / anterior) * 100);
  return <span className={p > 0 ? 'font-semibold text-[#15803D]' : p < 0 ? 'font-semibold text-[#C2410C]' : 'text-[var(--text-muted)]'}>{p > 0 ? `+${p}%` : `${p}%`}</span>;
}

/** Só para a prévia visual (imagens de modelo); a tela real busca no banco. */
export const COMPARATIVO_EXEMPLO: LinhaComparativo[] = [
  { periodo: '1º tri 2026', inicio: '2026-01-01', acessos: 3120, visitantes: 1480, novos: 1210, cliquesWhatsapp: 64, contatos: 41, ganhos: 2, valorGanho: 1380000 },
  { periodo: '2º tri 2026', inicio: '2026-04-01', acessos: 4870, visitantes: 2210, novos: 1690, cliquesWhatsapp: 97, contatos: 58, ganhos: 3, valorGanho: 2150000 },
  { periodo: '3º tri 2026', inicio: '2026-07-01', acessos: 6540, visitantes: 3020, novos: 2380, cliquesWhatsapp: 141, contatos: 83, ganhos: 5, valorGanho: 3420000 },
  { periodo: '4º tri 2026', inicio: '2026-10-01', acessos: 2210, visitantes: 1190, novos: 870, cliquesWhatsapp: 52, contatos: 29, ganhos: 1, valorGanho: 690000 }
];

export default function Comparativo({ previa }: { previa?: LinhaComparativo[] } = {}) {
  const [agrupar, setAgrupar] = useState<Agrupamento>('trimestre');
  const [chave, setChave] = useState<Chave>('acessos');
  const [linhas, setLinhas] = useState<LinhaComparativo[] | null>(previa ?? null);
  const [baixando, setBaixando] = useState(false);
  useEffect(() => {
    if (previa) return;
    setLinhas(null);
    comparativo(agrupar).then(setLinhas).catch(() => setLinhas([]));
  }, [agrupar]);

  const max = Math.max(1, ...(linhas ?? []).map((l) => l[chave]));
  const nomeAgrupar = AGRUPAR.find(([v]) => v === agrupar)?.[1] ?? '';
  const tabela = (): (string | number)[][] => [
    [nomeAgrupar, ...INDICADORES.map(([, l]) => l)],
    ...(linhas ?? []).map((l) => [l.periodo, ...INDICADORES.map(([k]) => l[k])])
  ];
  const arquivo = `resultados-por-${nomeAgrupar.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-bold">
            Comparativo de resultados<span className="ml-0.5 text-accent" title="Só o administrador principal vê">*</span>
          </h3>
          <p className="text-[13px] text-[var(--text-muted)]">A coleta de visitas começou em 30/09/2026; os períodos anteriores aparecem vazios.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!linhas?.length || baixando}
            onClick={async () => {
              setBaixando(true);
              await baixarXlsx(arquivo, [{ nome: `Por ${nomeAgrupar.toLowerCase()}`, linhas: tabela() }]).catch(() => alert('Não foi possível gerar a planilha.'));
              setBaixando(false);
            }}
            className="h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {baixando ? 'Gerando…' : 'Baixar XLSX'}
          </button>
          <button type="button" disabled={!linhas?.length} onClick={() => baixarCsv(arquivo, tabela())} className="h-9 rounded-full border border-[var(--border)] px-4 text-[13px] font-semibold disabled:opacity-50">
            Baixar CSV
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {AGRUPAR.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={agrupar === v} onClick={() => setAgrupar(v)} className={`rounded-full px-3.5 py-1.5 text-[13px] ${agrupar === v ? 'bg-ink font-semibold text-white' : 'bg-[var(--pill-bg)]'}`}>
            {l}
          </button>
        ))}
        <select value={chave} onChange={(e) => setChave(e.target.value as Chave)} className="ml-auto h-9 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] font-semibold" aria-label="Indicador do gráfico">
          {INDICADORES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {!linhas ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Ainda sem dados para comparar.</p>
      ) : (
        <>
          {/* gráfico de barras do indicador escolhido */}
          <div className="mt-5 flex h-44 items-end gap-3 overflow-x-auto pb-1">
            {linhas.map((l) => (
              <div key={l.inicio} className="flex h-full min-w-[56px] flex-1 flex-col items-center justify-end gap-1" title={`${l.periodo}: ${fmt(chave, l[chave])}`}>
                <span className="text-[11.5px] font-bold tabular-nums">{fmt(chave, l[chave])}</span>
                <div className="w-full max-w-[64px] rounded-t-lg bg-accent" style={{ height: `${Math.max(2, (l[chave] / max) * 100)}%` }} />
                <span className="whitespace-nowrap text-[11.5px] text-[var(--text-muted)]">{l.periodo}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[11.5px] text-[var(--text-muted)]">
                  <th className="py-2 pr-2 font-semibold">{nomeAgrupar}</th>
                  {INDICADORES.map(([k, l]) => (
                    <th key={k} className={`px-2 py-2 text-right font-semibold ${k === chave ? 'text-accent' : ''}`}>
                      {l}
                    </th>
                  ))}
                  <th className="py-2 pl-2 text-right font-semibold">Variação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={l.inicio} className="border-t border-[var(--border)]">
                    <td className="py-2 pr-2 font-semibold">{l.periodo}</td>
                    {INDICADORES.map(([k]) => (
                      <td key={k} className={`px-2 py-2 text-right tabular-nums ${k === chave ? 'font-bold' : ''}`}>
                        {fmt(k, l[k])}
                      </td>
                    ))}
                    <td className="py-2 pl-2 text-right tabular-nums">
                      <Variacao atual={l[chave]} anterior={linhas[i - 1]?.[chave]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">Variação do indicador em azul sobre o período anterior.</p>
          </div>
        </>
      )}
    </section>
  );
}

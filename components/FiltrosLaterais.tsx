'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_FILTERS, countActiveFilters, type FilterState } from '@/lib/filters';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';

// Filtros do feed na LATERAL ESQUERDA (recolhível). No topo ficam só Todos /
// Lançamentos e as tags de status. Tudo aqui aplica na hora, sem botão "Aplicar"
// (preço, área e ano aplicam ao sair do campo ou apertar Enter).
const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${on ? 'border-ink bg-ink text-white' : 'border-[var(--border)] hover:bg-[var(--pill-bg)]'}`;
const campo = 'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-ink';

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-bold uppercase tracking-wide">{titulo}</div>
      {children}
    </div>
  );
}

/** Dois campos "de / até" que aplicam ao sair do campo */
function Faixa({
  min,
  max,
  onChange,
  moeda,
  sufixo,
  ph
}: {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  moeda?: boolean;
  sufixo?: string;
  ph: [string, string];
}) {
  const fmt = (n: number | null) => (n ? (moeda ? n.toLocaleString('pt-BR') : String(n)) : '');
  const [a, setA] = useState(fmt(min));
  const [b, setB] = useState(fmt(max));
  useEffect(() => {
    setA(fmt(min));
    setB(fmt(max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]);
  const num = (s: string) => Number(s.replace(/\D/g, '')) || null;
  const aplicar = () => {
    let x = num(a);
    let y = num(b);
    if (x && y && x > y) [x, y] = [y, x];
    if (x !== min || y !== max) onChange(x, y);
  };
  const mascara = (s: string) => (moeda ? (num(s) ? num(s)!.toLocaleString('pt-BR') : '') : s.replace(/\D/g, '').slice(0, 7));
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        [a, setA, ph[0]],
        [b, setB, ph[1]]
      ].map(([v, set, p], k) => (
        <div key={k} className="relative">
          <input
            className={campo}
            inputMode="numeric"
            value={v as string}
            placeholder={p as string}
            onChange={(e) => (set as (s: string) => void)(mascara(e.target.value))}
            onBlur={aplicar}
            onKeyDown={(e) => e.key === 'Enter' && aplicar()}
          />
          {sufixo && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-faint)]">{sufixo}</span>}
        </div>
      ))}
    </div>
  );
}

export default function FiltrosLaterais({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => onChange({ ...filters, [k]: v });
  const alternarTipo = (t: TipoUnidade) => set('tipos', filters.tipos.includes(t) ? filters.tipos.filter((x) => x !== t) : [...filters.tipos, t]);
  const ano = new Date().getFullYear();
  const ativos = countActiveFilters({ ...filters, situacao: 'todas', termos: [], locais: [] });

  return (
    <div className="flex flex-col gap-6">
      <Secao titulo="Comprar ou alugar">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['todas', 'Todos'],
              ['venda', 'Comprar'],
              ['aluguel', 'Alugar']
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" className={chip(filters.finalidade === v)} onClick={() => set('finalidade', v)}>
              {l}
            </button>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tipo de imóvel">
        <div className="flex flex-col gap-3">
          {TIPO_UNIDADE_GRUPOS.map((g) => (
            <div key={g.label}>
              <div className="mb-1.5 text-[11px] font-semibold text-[var(--text-muted)]">{g.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.tipos.map((t) => (
                  <button key={t} type="button" className={chip(filters.tipos.includes(t))} onClick={() => alternarTipo(t)}>
                    {TIPO_UNIDADE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Preço (R$)">
        <Faixa min={filters.precoMin} max={filters.precoMax} moeda ph={['de', 'até']} onChange={(a, b) => onChange({ ...filters, precoMin: a, precoMax: b })} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            ['Até 500 mil', null, 500000],
            ['500 mil a 1 mi', 500000, 1000000],
            ['1 a 2 mi', 1000000, 2000000],
            ['Acima de 2 mi', 2000000, null]
          ].map(([l, a, b]) => (
            <button
              key={l as string}
              type="button"
              className={chip(filters.precoMin === a && filters.precoMax === b)}
              onClick={() => onChange({ ...filters, precoMin: a as number | null, precoMax: b as number | null })}
            >
              {l as string}
            </button>
          ))}
        </div>
      </Secao>

      <Secao titulo="Quartos">
        <div className="flex flex-wrap gap-1.5">
          {([1, 2, 3, 4] as const).map((n) => (
            <button key={n} type="button" className={chip(filters.quartosMin === n)} onClick={() => set('quartosMin', filters.quartosMin === n ? 'todas' : n)}>
              {n}+
            </button>
          ))}
        </div>
      </Secao>

      <Secao titulo="Vagas">
        <div className="flex flex-wrap gap-1.5">
          {([1, 2, 3] as const).map((n) => (
            <button key={n} type="button" className={chip(filters.vagasMin === n)} onClick={() => set('vagasMin', filters.vagasMin === n ? 'todas' : n)}>
              {n}+
            </button>
          ))}
        </div>
      </Secao>

      <Secao titulo="Metragem (m²)">
        <Faixa min={filters.areaMin} max={filters.areaMax} sufixo="m²" ph={['de', 'até']} onChange={(a, b) => onChange({ ...filters, areaMin: a, areaMax: b })} />
      </Secao>

      <Secao titulo="Ano de entrega">
        <Faixa min={filters.anoMin} max={filters.anoMax} ph={['de', 'até']} onChange={(a, b) => onChange({ ...filters, anoMin: a, anoMax: b })} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            ['Na planta', ano + 1, null],
            [`Até ${ano - 5}`, null, ano - 5],
            [`${ano - 5}–${ano}`, ano - 5, ano]
          ].map(([l, a, b]) => (
            <button
              key={l as string}
              type="button"
              className={chip(filters.anoMin === a && filters.anoMax === b)}
              onClick={() => onChange({ ...filters, anoMin: a as number | null, anoMax: b as number | null })}
            >
              {l as string}
            </button>
          ))}
        </div>
      </Secao>

      <Secao titulo="Temporada">
        <button type="button" className={chip(filters.aceitaTemporada === 'sim')} onClick={() => set('aceitaTemporada', filters.aceitaTemporada === 'sim' ? 'todas' : 'sim')}>
          Aceita temporada
        </button>
      </Secao>

      {ativos > 0 && (
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_FILTERS, modo: filters.modo, situacao: filters.situacao, termos: filters.termos, locais: filters.locais })}
          className="rounded-full border border-ink py-2 text-[13px] font-semibold hover:bg-ink hover:text-white"
        >
          Limpar filtros ({ativos})
        </button>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { DEFAULT_FILTERS, countActiveFilters, type FilterState } from '@/lib/filters';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL } from '@/lib/tipologias';

type Props = {
  filters: FilterState;
  onChange: (next: FilterState) => void;
};

const selectClass =
  'shrink-0 appearance-none rounded-full bg-[var(--pill-bg)] px-4 py-2.5 pr-8 text-[13px] font-semibold hover:bg-[var(--pill-bg-hover)] cursor-pointer outline-none';

// seta customizada via background-image inline pra não depender de mais um ícone
const selectStyle: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B6F76' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center'
};

const pillClass = 'shrink-0 rounded-full px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap';

function anoLabel(min: number | null, max: number | null): string {
  if (min && max) return min === max ? `Entrega em ${min}` : `Entrega ${min}–${max}`;
  if (min) return `Entrega a partir de ${min}`;
  if (max) return `Entrega até ${max}`;
  return 'Ano de entrega';
}

export default function FilterBar({ filters, onChange }: Props) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  // Painel do ano de entrega — digita um ano só ou uma faixa (ex: 2020 a 2025)
  const [anoOpen, setAnoOpen] = useState(false);
  const [anoMinText, setAnoMinText] = useState('');
  const [anoMaxText, setAnoMaxText] = useState('');
  useEffect(() => {
    setAnoMinText(filters.anoMin ? String(filters.anoMin) : '');
    setAnoMaxText(filters.anoMax ? String(filters.anoMax) : '');
  }, [filters.anoMin, filters.anoMax]);

  const aplicarAno = () => {
    let min = /^\d{4}$/.test(anoMinText) ? Number(anoMinText) : null;
    let max = /^\d{4}$/.test(anoMaxText) ? Number(anoMaxText) : null;
    if (min && max && min > max) [min, max] = [max, min];
    onChange({ ...filters, anoMin: min, anoMax: max });
    setAnoOpen(false);
  };

  const anoAtivo = !!(filters.anoMin || filters.anoMax);
  const ativos = countActiveFilters(filters);
  const anoAtual = new Date().getFullYear();

  return (
    <div className="relative border-b border-[var(--border)]">
    <div className="flex gap-2 overflow-x-auto px-4 py-3.5 [scrollbar-width:none] md:gap-2.5 md:px-8 md:py-4 [&::-webkit-scrollbar]:hidden">
      <div className="flex shrink-0 rounded-full bg-[var(--pill-bg)] p-1">
        <button
          type="button"
          onClick={() => set('modo', 'todos')}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap ${filters.modo === 'todos' ? 'bg-ink text-white' : 'text-[var(--text-muted)]'}`}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => set('modo', 'lancamentos')}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap ${filters.modo === 'lancamentos' ? 'bg-ink text-white' : 'text-[var(--text-muted)]'}`}
        >
          Lançamentos e empreendimentos
        </button>
      </div>

      {filters.q && (
        <button
          type="button"
          onClick={() => set('q', '')}
          className={`${pillClass} flex items-center gap-1.5 bg-accent text-ink`}
          title="Limpar busca"
        >
          “{filters.q}” <span aria-hidden>✕</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => setAnoOpen((o) => !o)}
        className={`${pillClass} ${anoAtivo ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
        aria-expanded={anoOpen}
      >
        {anoLabel(filters.anoMin, filters.anoMax)} ▾
      </button>
      <select
        className={selectClass}
        style={selectStyle}
        value={filters.finalidade}
        onChange={(e) => set('finalidade', e.target.value as FilterState['finalidade'])}
      >
        <option value="todas">Finalidade</option>
        <option value="venda">Comprar</option>
        <option value="aluguel">Alugar</option>
      </select>

      <select
        className={selectClass}
        style={selectStyle}
        value={filters.tipoUnidade}
        onChange={(e) => set('tipoUnidade', e.target.value as FilterState['tipoUnidade'])}
      >
        <option value="todas">Tipo de imóvel</option>
        {TIPO_UNIDADE_GRUPOS.map((grupo) => (
          <optgroup key={grupo.label} label={grupo.label}>
            {grupo.tipos.map((tipo) => (
              <option key={tipo} value={tipo}>
                {TIPO_UNIDADE_LABEL[tipo]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <select
        className={selectClass}
        style={selectStyle}
        value={String(filters.precoMax)}
        onChange={(e) => set('precoMax', (e.target.value === 'todas' ? 'todas' : Number(e.target.value)) as FilterState['precoMax'])}
      >
        <option value="todas">Faixa de preço</option>
        <option value="500000">Até R$ 500 mil</option>
        <option value="1000000">Até R$ 1 milhão</option>
        <option value="2000000">Até R$ 2 milhões</option>
      </select>

      <select
        className={selectClass}
        style={selectStyle}
        value={String(filters.quartosMin)}
        onChange={(e) => set('quartosMin', (e.target.value === 'todas' ? 'todas' : Number(e.target.value)) as FilterState['quartosMin'])}
      >
        <option value="todas">Quartos</option>
        <option value="1">1+</option>
        <option value="2">2+</option>
        <option value="3">3+</option>
        <option value="4">4+</option>
      </select>

      <select
        className={selectClass}
        style={selectStyle}
        value={String(filters.vagasMin)}
        onChange={(e) => set('vagasMin', (e.target.value === 'todas' ? 'todas' : Number(e.target.value)) as FilterState['vagasMin'])}
      >
        <option value="todas">Vagas de garagem</option>
        <option value="1">1+</option>
        <option value="2">2+</option>
        <option value="3">3+</option>
      </select>

      <select
        className={selectClass}
        style={selectStyle}
        value={filters.situacao}
        onChange={(e) => set('situacao', e.target.value as FilterState['situacao'])}
      >
        <option value="todas">Situação</option>
        <option value="lancamento">Lançamento</option>
        <option value="seminovo">Seminovo</option>
        <option value="usado">Usado</option>
      </select>

      <select
        className={selectClass}
        style={selectStyle}
        value={filters.aceitaTemporada}
        onChange={(e) => set('aceitaTemporada', e.target.value as FilterState['aceitaTemporada'])}
      >
        <option value="todas">Aceita temporada</option>
        <option value="sim">Só com temporada</option>
      </select>

      {ativos > 0 && (
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_FILTERS, modo: filters.modo })}
          className={`${pillClass} text-[var(--text-muted)] underline-offset-2 hover:underline`}
        >
          Limpar filtros ({ativos})
        </button>
      )}
    </div>

    {anoOpen && (
      <div className="absolute left-4 top-full z-40 mt-1 w-[300px] rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 shadow-xl md:left-8">
        <div className="mb-1 text-sm font-bold">Ano de entrega</div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Digite um ano só (ex: 2027) ou uma faixa (ex: de 2020 até 2025).</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            aplicarAno();
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
              De
              <input
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={anoMinText}
                onChange={(e) => setAnoMinText(e.target.value.replace(/\D/g, ''))}
                placeholder={String(anoAtual - 5)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
              Até
              <input
                inputMode="numeric"
                maxLength={4}
                value={anoMaxText}
                onChange={(e) => setAnoMaxText(e.target.value.replace(/\D/g, ''))}
                placeholder={String(anoAtual + 3)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] outline-none"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: `Só ${anoAtual + 1}`, min: anoAtual + 1, max: anoAtual + 1 },
              { label: `De ${anoAtual} em diante`, min: anoAtual, max: null },
              { label: 'Últimos 5 anos', min: anoAtual - 5, max: anoAtual }
            ].map((atalho) => (
              <button
                key={atalho.label}
                type="button"
                onClick={() => {
                  onChange({ ...filters, anoMin: atalho.min, anoMax: atalho.max });
                  setAnoOpen(false);
                }}
                className="rounded-full bg-[var(--pill-bg)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--pill-bg-hover)]"
              >
                {atalho.label}
              </button>
            ))}
          </div>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onChange({ ...filters, anoMin: null, anoMax: null });
                setAnoOpen(false);
              }}
              className="text-xs font-semibold text-[var(--text-muted)] hover:underline"
            >
              Limpar
            </button>
            <button type="submit" className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white hover:opacity-90">
              Aplicar
            </button>
          </div>
        </form>
      </div>
    )}
    </div>
  );
}

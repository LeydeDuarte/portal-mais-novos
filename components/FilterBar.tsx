'use client';

import type { CSSProperties } from 'react';
import type { FilterState } from '@/lib/filters';
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

export default function FilterBar({ filters, onChange }: Props) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-[var(--border)] px-4 py-3.5 [scrollbar-width:none] md:gap-2.5 md:px-8 md:py-4 [&::-webkit-scrollbar]:hidden">
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
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DEFAULT_FILTERS, countActiveFilters, type FilterState } from '@/lib/filters';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { maskCurrencyInput } from '@/lib/currency';

type Props = {
  filters: FilterState;
  onChange: (next: FilterState) => void;
};

type Painel = 'tipo' | 'preco' | 'area' | 'ano';

const selectClass =
  'shrink-0 appearance-none rounded-full bg-[var(--pill-bg)] px-4 py-2.5 pr-8 text-[13px] font-semibold hover:bg-[var(--pill-bg-hover)] cursor-pointer outline-none';
const selectStyle: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B6F76' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center'
};
const pillClass = 'shrink-0 rounded-full px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap';
const inputClass = 'w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] outline-none';
const PANEL_W = 320;

function fmtPreco(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  return `R$ ${Math.round(n / 1000).toLocaleString('pt-BR')} mil`;
}
function rangeLabel(min: number | null, max: number | null, fmt: (n: number) => string, vazio: string): string {
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `A partir de ${fmt(min)}`;
  if (max) return `Até ${fmt(max)}`;
  return vazio;
}
const fmtArea = (n: number) => `${n.toLocaleString('pt-BR')} m²`;
const fmtAno = (n: number) => String(n);

function ordenar(min: number | null, max: number | null): [number | null, number | null] {
  return min && max && min > max ? [max, min] : [min, max];
}

function PanelShell({ title, hint, children, onClear, onApply }: { title: string; hint?: string; children: ReactNode; onClear: () => void; onApply?: () => void }) {
  return (
    <>
      <div className="mb-1 text-sm font-bold">{title}</div>
      {hint && <p className="mb-3 text-xs text-[var(--text-muted)]">{hint}</p>}
      {children}
      <div className="mt-3 flex justify-between gap-2">
        <button type="button" onClick={onClear} className="text-xs font-semibold text-[var(--text-muted)] hover:underline">
          Limpar
        </button>
        {onApply && (
          <button type="submit" className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white hover:opacity-90">
            Aplicar
          </button>
        )}
      </div>
    </>
  );
}

function Atalhos({ itens }: { itens: { label: string; onClick: () => void }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {itens.map((a) => (
        <button key={a.label} type="button" onClick={a.onClick} className="rounded-full bg-[var(--pill-bg)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--pill-bg-hover)]">
          {a.label}
        </button>
      ))}
    </div>
  );
}

export default function FilterBar({ filters, onChange }: Props) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => onChange({ ...filters, [key]: value });

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [panelLeft, setPanelLeft] = useState(16);

  // Fecha o painel ao clicar fora
  useEffect(() => {
    if (!painel) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPainel(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPainel(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [painel]);

  const abrir = (qual: Painel, e: React.MouseEvent<HTMLButtonElement>) => {
    if (painel === qual) return setPainel(null);
    const wrap = wrapRef.current?.getBoundingClientRect();
    const btn = e.currentTarget.getBoundingClientRect();
    const width = wrap?.width ?? 1000;
    const left = wrap ? btn.left - wrap.left : 16;
    setPanelLeft(Math.max(8, Math.min(left, width - Math.min(PANEL_W, width - 16) - 8)));
    setPainel(qual);
  };

  // Rascunhos locais dos painéis (só vão para o filtro ao aplicar)
  const [tiposTmp, setTiposTmp] = useState<TipoUnidade[]>(filters.tipos);
  const [precoMinTxt, setPrecoMinTxt] = useState('');
  const [precoMaxTxt, setPrecoMaxTxt] = useState('');
  const [areaMinTxt, setAreaMinTxt] = useState('');
  const [areaMaxTxt, setAreaMaxTxt] = useState('');
  const [anoMinTxt, setAnoMinTxt] = useState('');
  const [anoMaxTxt, setAnoMaxTxt] = useState('');
  useEffect(() => {
    setTiposTmp(filters.tipos);
    setPrecoMinTxt(filters.precoMin ? String(filters.precoMin) : '');
    setPrecoMaxTxt(filters.precoMax ? String(filters.precoMax) : '');
    setAreaMinTxt(filters.areaMin ? String(filters.areaMin) : '');
    setAreaMaxTxt(filters.areaMax ? String(filters.areaMax) : '');
    setAnoMinTxt(filters.anoMin ? String(filters.anoMin) : '');
    setAnoMaxTxt(filters.anoMax ? String(filters.anoMax) : '');
  }, [filters, painel]);

  const digits = (s: string) => Number(s.replace(/\D/g, '')) || null;
  const aplicar = (patch: Partial<FilterState>) => {
    onChange({ ...filters, ...patch });
    setPainel(null);
  };

  const ativos = countActiveFilters(filters);
  const anoAtual = new Date().getFullYear();
  const tipoLabel =
    filters.tipos.length === 0
      ? 'Tipo de imóvel'
      : filters.tipos.length === 1
        ? TIPO_UNIDADE_LABEL[filters.tipos[0]]
        : `${TIPO_UNIDADE_LABEL[filters.tipos[0]]} +${filters.tipos.length - 1}`;
  const on = (ativo: boolean) => (ativo ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]');

  return (
    <div ref={wrapRef} className="relative border-b border-[var(--border)]">
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3.5 [scrollbar-width:none] md:gap-2.5 md:px-8 md:py-4 [&::-webkit-scrollbar]:hidden">
        <div className="flex shrink-0 rounded-full bg-[var(--pill-bg)] p-1">
          {(['todos', 'lancamentos'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set('modo', m)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap ${filters.modo === m ? 'bg-ink text-white' : 'text-[var(--text-muted)]'}`}
            >
              {m === 'todos' ? 'Todos' : 'Lançamentos e empreendimentos'}
            </button>
          ))}
        </div>

        {/* Balões de local (exatos) e de palavra-chave — cada um sai com o seu ✕ */}
        {filters.locais.map((l) => (
          <button
            key={`${l.tipo}-${l.id ?? ''}-${l.nome}-${l.cidade}`}
            type="button"
            onClick={() => set('locais', filters.locais.filter((x) => x !== l))}
            className={`${pillClass} flex items-center gap-1.5 bg-ink text-white`}
            title={`Tirar ${l.nome} da busca`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {l.nome}
            {l.tipo !== 'cidade' && <span className="font-normal opacity-70">· {l.cidade}</span>}
            <span aria-hidden>✕</span>
          </button>
        ))}
        {filters.termos.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => set('termos', filters.termos.filter((x) => x !== t))}
            className={`${pillClass} flex items-center gap-1.5 bg-accent text-ink`}
            title={`Tirar "${t}" da busca`}
          >
            {t} <span aria-hidden>✕</span>
          </button>
        ))}

        {ativos > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS, modo: filters.modo })}
            className={`${pillClass} border border-ink text-ink hover:bg-ink hover:text-white`}
          >
            Limpar tudo ✕
          </button>
        )}

        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--border)]" aria-hidden />

        <button type="button" onClick={(e) => abrir('tipo', e)} className={`${pillClass} ${on(filters.tipos.length > 0)}`} aria-expanded={painel === 'tipo'}>
          {tipoLabel} ▾
        </button>
        <button type="button" onClick={(e) => abrir('preco', e)} className={`${pillClass} ${on(!!(filters.precoMin || filters.precoMax))}`} aria-expanded={painel === 'preco'}>
          {rangeLabel(filters.precoMin, filters.precoMax, fmtPreco, 'Preço')} ▾
        </button>
        <button type="button" onClick={(e) => abrir('area', e)} className={`${pillClass} ${on(!!(filters.areaMin || filters.areaMax))}`} aria-expanded={painel === 'area'}>
          {rangeLabel(filters.areaMin, filters.areaMax, fmtArea, 'Metragem')} ▾
        </button>

        <select
          className={selectClass}
          style={selectStyle}
          value={String(filters.quartosMin)}
          onChange={(e) => set('quartosMin', (e.target.value === 'todas' ? 'todas' : Number(e.target.value)) as FilterState['quartosMin'])}
        >
          <option value="todas">Quartos</option>
          <option value="1">1+ quarto</option>
          <option value="2">2+ quartos</option>
          <option value="3">3+ quartos</option>
          <option value="4">4+ quartos</option>
        </select>

        <select
          className={selectClass}
          style={selectStyle}
          value={String(filters.vagasMin)}
          onChange={(e) => set('vagasMin', (e.target.value === 'todas' ? 'todas' : Number(e.target.value)) as FilterState['vagasMin'])}
        >
          <option value="todas">Vagas</option>
          <option value="1">1+ vaga</option>
          <option value="2">2+ vagas</option>
          <option value="3">3+ vagas</option>
        </select>

        <button type="button" onClick={(e) => abrir('ano', e)} className={`${pillClass} ${on(!!(filters.anoMin || filters.anoMax))}`} aria-expanded={painel === 'ano'}>
          {filters.anoMin && filters.anoMax && filters.anoMin === filters.anoMax
            ? `Entrega em ${filters.anoMin}`
            : rangeLabel(filters.anoMin, filters.anoMax, fmtAno, 'Ano de entrega').replace('A partir de', 'Entrega desde').replace('Até', 'Entrega até')}{' '}
          ▾
        </button>

        <select className={selectClass} style={selectStyle} value={filters.finalidade} onChange={(e) => set('finalidade', e.target.value as FilterState['finalidade'])}>
          <option value="todas">Comprar ou alugar</option>
          <option value="venda">Comprar</option>
          <option value="aluguel">Alugar</option>
        </select>

        <select className={selectClass} style={selectStyle} value={filters.situacao} onChange={(e) => set('situacao', e.target.value as FilterState['situacao'])}>
          <option value="todas">Situação</option>
          <option value="lancamento">Lançamento</option>
          <option value="seminovo">Seminovo</option>
          <option value="usado">Usado</option>
        </select>

        <select className={selectClass} style={selectStyle} value={filters.aceitaTemporada} onChange={(e) => set('aceitaTemporada', e.target.value as FilterState['aceitaTemporada'])}>
          <option value="todas">Aceita temporada</option>
          <option value="sim">Só com temporada</option>
        </select>
      </div>

      {painel && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (painel === 'tipo') aplicar({ tipos: tiposTmp });
            if (painel === 'preco') {
              const [a, b] = ordenar(digits(precoMinTxt), digits(precoMaxTxt));
              aplicar({ precoMin: a, precoMax: b });
            }
            if (painel === 'area') {
              const [a, b] = ordenar(digits(areaMinTxt), digits(areaMaxTxt));
              aplicar({ areaMin: a, areaMax: b });
            }
            if (painel === 'ano') {
              const ok = (s: string) => (/^\d{4}$/.test(s) ? Number(s) : null);
              const [a, b] = ordenar(ok(anoMinTxt), ok(anoMaxTxt));
              aplicar({ anoMin: a, anoMax: b });
            }
          }}
          className="absolute top-full z-40 mt-1 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 shadow-xl"
          style={{ left: panelLeft, width: `min(${painel === 'tipo' ? 380 : PANEL_W}px, calc(100vw - 32px))` }}
        >
          {painel === 'tipo' && (
            <PanelShell title="Tipo de imóvel" hint="Marque quantos quiser." onClear={() => aplicar({ tipos: [] })} onApply={() => undefined}>
              <div className="flex max-h-[50vh] flex-col gap-3 overflow-auto">
                {TIPO_UNIDADE_GRUPOS.map((g) => (
                  <div key={g.label}>
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">{g.label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.tipos.map((t) => {
                        const sel = tiposTmp.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTiposTmp((prev) => (sel ? prev.filter((x) => x !== t) : [...prev, t]))}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${sel ? 'border-ink bg-ink text-white' : 'border-[var(--border)] hover:bg-[var(--pill-bg)]'}`}
                          >
                            {sel ? '✓ ' : ''}
                            {TIPO_UNIDADE_LABEL[t]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </PanelShell>
          )}

          {painel === 'preco' && (
            <PanelShell title="Faixa de preço" hint="Preencha só um lado se quiser (ex: até R$ 1 milhão)." onClear={() => aplicar({ precoMin: null, precoMax: null })} onApply={() => undefined}>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                  De
                  <input autoFocus inputMode="numeric" className={inputClass} value={maskCurrencyInput(precoMinTxt)} onChange={(e) => setPrecoMinTxt(e.target.value.replace(/\D/g, ''))} placeholder="R$ 0" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                  Até
                  <input inputMode="numeric" className={inputClass} value={maskCurrencyInput(precoMaxTxt)} onChange={(e) => setPrecoMaxTxt(e.target.value.replace(/\D/g, ''))} placeholder="Sem limite" />
                </label>
              </div>
              <Atalhos
                itens={[
                  { label: 'Até R$ 1 mi', onClick: () => aplicar({ precoMin: null, precoMax: 1_000_000 }) },
                  { label: 'R$ 1 a 2 mi', onClick: () => aplicar({ precoMin: 1_000_000, precoMax: 2_000_000 }) },
                  { label: 'R$ 2 a 5 mi', onClick: () => aplicar({ precoMin: 2_000_000, precoMax: 5_000_000 }) },
                  { label: 'Acima de R$ 5 mi', onClick: () => aplicar({ precoMin: 5_000_000, precoMax: null }) },
                  { label: 'Até R$ 500 mil', onClick: () => aplicar({ precoMin: null, precoMax: 500_000 }) }
                ]}
              />
            </PanelShell>
          )}

          {painel === 'area' && (
            <PanelShell title="Metragem (área privativa)" hint="Em m². Preencha só um lado se quiser." onClear={() => aplicar({ areaMin: null, areaMax: null })} onApply={() => undefined}>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                  De (m²)
                  <input autoFocus inputMode="numeric" className={inputClass} value={areaMinTxt} onChange={(e) => setAreaMinTxt(e.target.value.replace(/\D/g, ''))} placeholder="0" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                  Até (m²)
                  <input inputMode="numeric" className={inputClass} value={areaMaxTxt} onChange={(e) => setAreaMaxTxt(e.target.value.replace(/\D/g, ''))} placeholder="Sem limite" />
                </label>
              </div>
              <Atalhos
                itens={[
                  { label: 'Até 60 m²', onClick: () => aplicar({ areaMin: null, areaMax: 60 }) },
                  { label: '60 a 100 m²', onClick: () => aplicar({ areaMin: 60, areaMax: 100 }) },
                  { label: '100 a 200 m²', onClick: () => aplicar({ areaMin: 100, areaMax: 200 }) },
                  { label: 'Acima de 200 m²', onClick: () => aplicar({ areaMin: 200, areaMax: null }) }
                ]}
              />
            </PanelShell>
          )}

          {painel === 'ano' && (
            <PanelShell title="Ano de entrega" hint="Digite um ano só (ex: 2027) ou uma faixa (ex: de 2020 até 2025)." onClear={() => aplicar({ anoMin: null, anoMax: null })} onApply={() => undefined}>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                  De
                  <input autoFocus inputMode="numeric" maxLength={4} className={inputClass} value={anoMinTxt} onChange={(e) => setAnoMinTxt(e.target.value.replace(/\D/g, ''))} placeholder={String(anoAtual - 5)} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
                  Até
                  <input inputMode="numeric" maxLength={4} className={inputClass} value={anoMaxTxt} onChange={(e) => setAnoMaxTxt(e.target.value.replace(/\D/g, ''))} placeholder={String(anoAtual + 3)} />
                </label>
              </div>
              <Atalhos
                itens={[
                  { label: `Só ${anoAtual + 1}`, onClick: () => aplicar({ anoMin: anoAtual + 1, anoMax: anoAtual + 1 }) },
                  { label: `De ${anoAtual} em diante`, onClick: () => aplicar({ anoMin: anoAtual, anoMax: null }) },
                  { label: 'Últimos 5 anos', onClick: () => aplicar({ anoMin: anoAtual - 5, anoMax: anoAtual }) }
                ]}
              />
            </PanelShell>
          )}
        </form>
      )}
    </div>
  );
}

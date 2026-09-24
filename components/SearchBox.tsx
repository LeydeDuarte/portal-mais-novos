'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getLocationIndex, type LocalSugestao } from '@/lib/actions';
import { localKey, type LocalFiltro } from '@/lib/filters';

function normalize(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const TIPO_LABEL = { cidade: 'Cidade', bairro: 'Bairro', condominio: 'Condomínio' } as const;

type Props = {
  locais: LocalFiltro[];
  onToggleLocal: (l: LocalFiltro) => void;
  onSearchText: (texto: string) => void;
};

function Pin({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

// Campo de busca do feed com a lista de locais (estilo portal): ao clicar,
// mostra as cidades e os bairros onde EXISTEM anúncios; ao digitar, filtra
// cidades, bairros e condomínios. Marcar um local vira um balão exato
// (Setor Marista de Goiânia não mistura com outro "Marista"). Enter com um
// texto que não é local vira um balão de busca livre.
export default function SearchBox({ locais, onToggleLocal, onSearchText }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<LocalSugestao[] | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && index === null) getLocationIndex().then(setIndex).catch(() => setIndex([]));
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selecionados = useMemo(() => new Set(locais.map(localKey)), [locais]);
  const toFiltro = (s: LocalSugestao): LocalFiltro => ({ tipo: s.tipo, nome: s.nome, cidade: s.cidade, uf: s.uf, id: s.id });

  const grupos = useMemo(() => {
    const all = index ?? [];
    const tokens = normalize(q).split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      return [
        { titulo: 'Cidades', itens: all.filter((s) => s.tipo === 'cidade').slice(0, 8) },
        { titulo: 'Bairros com mais anúncios', itens: all.filter((s) => s.tipo === 'bairro').slice(0, 8) }
      ];
    }
    const match = (s: LocalSugestao) => {
      const hay = normalize(`${s.nome} ${s.cidade} ${s.uf}`);
      return tokens.every((t) => hay.includes(t));
    };
    return (['cidade', 'bairro', 'condominio'] as const).map((tipo) => ({
      titulo: tipo === 'cidade' ? 'Cidades' : tipo === 'bairro' ? 'Bairros' : 'Condomínios',
      itens: all.filter((s) => s.tipo === tipo && match(s)).slice(0, 8)
    }));
  }, [index, q]);

  const totalSugestoes = grupos.reduce((n, g) => n + g.itens.length, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const texto = q.trim();
    if (!texto) return;
    // Se o texto é exatamente o nome de um local, marca o local; senão vira busca livre
    const exato = (index ?? []).find((s) => normalize(s.nome) === normalize(texto));
    if (exato) {
      if (!selecionados.has(localKey(toFiltro(exato)))) onToggleLocal(toFiltro(exato));
    } else {
      onSearchText(texto);
    }
    setQ('');
  };

  return (
    <div ref={wrapRef} className="relative flex max-w-[560px] flex-grow">
      <form onSubmit={submit} role="search" className="flex w-full items-center gap-2 rounded-full bg-[var(--pill-bg)] px-4 py-2.5">
        <Pin className="shrink-0 text-accent" />
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Cidade, bairro, condomínio ou palavra-chave"
          aria-label="Buscar imóveis"
          autoComplete="off"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
        />
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] min-w-[300px] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)] py-2 shadow-2xl">
          {index === null && <p className="px-4 py-3 text-sm text-[var(--text-muted)]">Carregando locais…</p>}

          {index !== null &&
            grupos
              .filter((g) => g.itens.length)
              .map((g) => (
                <div key={g.titulo} className="py-1">
                  <div className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">{g.titulo}</div>
                  {g.itens.map((s) => {
                    const f = toFiltro(s);
                    const marcado = selecionados.has(localKey(f));
                    return (
                      <button
                        key={localKey(f)}
                        type="button"
                        onClick={() => onToggleLocal(f)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--pill-bg)]"
                      >
                        <Pin className="shrink-0 text-[var(--text-muted)]" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-semibold">{s.nome}</span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {TIPO_LABEL[s.tipo]} · {s.tipo === 'cidade' ? s.uf : `${s.cidade}${s.uf ? ` — ${s.uf}` : ''}`} · {s.total} anúncio{s.total === 1 ? '' : 's'}
                          </span>
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${
                            marcado ? 'border-ink bg-ink text-white' : 'border-[var(--text-faint)]'
                          }`}
                          aria-hidden
                        >
                          {marcado ? '✓' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}

          {index !== null && q.trim() && totalSugestoes === 0 && (
            <p className="px-4 py-2 text-sm text-[var(--text-muted)]">Nenhum local com anúncios com esse nome.</p>
          )}

          {q.trim() && (
            <button
              type="button"
              onClick={() => {
                onSearchText(q.trim());
                setQ('');
              }}
              className="mt-1 flex w-full items-center gap-3 border-t border-[var(--border)] px-4 py-3 text-left text-sm hover:bg-[var(--pill-bg)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--text-muted)]" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span>
                Buscar <strong>“{q.trim()}”</strong> como palavra-chave
              </span>
            </button>
          )}

          {locais.length > 0 && (
            <div className="flex justify-end border-t border-[var(--border)] px-4 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-white">
                Ver {locais.length === 1 ? 'resultados' : `resultados (${locais.length} locais)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

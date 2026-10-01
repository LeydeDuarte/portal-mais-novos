'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UFS, urlRegiao } from '@/lib/news/base';

type R = { uf: string; cidade: string | null; n: number };
type Local = { uf: string; cidade: string | null; nome: string; url: string } | null;

const Pino = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

function guardar(uf: string | null, cidade: string | null) {
  const v = uf ? encodeURIComponent(`${uf}|${cidade ?? ''}`) : 'todas';
  document.cookie = `mnn_regiao=${v}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** Botão "Goiânia · GO ▾" no topo do News: escolher a região ou ver todas */
export function SeletorRegiao({ regioes, atual }: { regioes: R[]; atual?: string }) {
  const [aberto, setAberto] = useState(false);
  const [local, setLocal] = useState<Local>(null);
  const router = useRouter();
  const caixa = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/news/local')
      .then((r) => r.json())
      .then((j) => setLocal(j.regiao ?? null))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const rotulo = atual
    ? atual.includes('/')
      ? `${atual.split('/')[1]} · ${atual.split('/')[0]}`
      : UFS[atual] ?? atual
    : local?.nome ?? 'Todas as regiões';
  const ir = (uf: string | null, cidade: string | null) => {
    guardar(uf, cidade);
    setAberto(false);
    router.push(uf ? urlRegiao(uf, cidade) : '/news');
  };
  const ufs = regioes.filter((r) => !r.cidade);

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm font-semibold"
      >
        <Pino />
        <span className="max-w-[180px] truncate">{rotulo}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {aberto && (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[280px] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-2 shadow-xl">
          {local && (
            <button type="button" onClick={() => ir(local.uf, local.cidade)} className="mb-1 flex w-full items-center gap-2 rounded-xl bg-[var(--pill-bg)] px-3 py-2.5 text-left text-sm font-semibold">
              <Pino /> Perto de você: {local.nome}
            </button>
          )}
          <button type="button" onClick={() => ir(null, null)} className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--pill-bg)]">
            Todas as regiões
          </button>
          {ufs.map((u) => (
            <div key={u.uf}>
              <button type="button" onClick={() => ir(u.uf, null)} className="flex w-full justify-between rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-[var(--pill-bg)]">
                <span>{UFS[u.uf] ?? u.uf}</span>
                <span className="font-medium text-[var(--text-muted)]">{u.n}</span>
              </button>
              {regioes
                .filter((c) => c.uf === u.uf && c.cidade)
                .map((c) => (
                  <button key={c.cidade} type="button" onClick={() => ir(c.uf, c.cidade)} className="flex w-full justify-between rounded-xl py-1.5 pl-7 pr-3 text-left text-sm hover:bg-[var(--pill-bg)]">
                    <span>{c.cidade}</span>
                    <span className="text-[var(--text-muted)]">{c.n}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Na capa: sugere as notícias da região do visitante (sem redirecionar: o Google vê a capa inteira) */
export function SugestaoRegiao() {
  const [local, setLocal] = useState<Local>(null);
  const [origem, setOrigem] = useState<string>('');
  const [fechado, setFechado] = useState(false);
  const router = useRouter();
  useEffect(() => {
    fetch('/api/news/local')
      .then((r) => r.json())
      .then((j) => {
        setLocal(j.regiao ?? null);
        setOrigem(j.origem);
      })
      .catch(() => {});
  }, []);
  if (!local || fechado) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-[#F3F7FF] px-4 py-3 text-sm">
      <span className="text-accent">
        <Pino />
      </span>
      <span>
        {origem === 'escolha' ? 'Sua região:' : 'Parece que você está em'} <strong>{local.nome}</strong>.
      </span>
      <button
        type="button"
        onClick={() => {
          guardar(local.uf, local.cidade);
          router.push(local.url);
        }}
        className="font-semibold text-accent hover:underline"
      >
        Ver só as novidades daqui →
      </button>
      <button type="button" aria-label="Fechar" onClick={() => setFechado(true)} className="ml-auto text-[var(--text-muted)]">
        ✕
      </button>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { onlineAgora, type Online } from '@/lib/painel-dados';

// "Agora no site": visitantes com a página aberta e visível nos últimos minutos.
// Atualiza sozinho a cada 30 s (só enquanto o painel está visível na tela).
export default function OnlineAgora() {
  const [min, setMin] = useState(5);
  const [d, setD] = useState<Online | null>(null);
  const [aberto, setAberto] = useState(true);
  useEffect(() => {
    let vivo = true;
    const carregar = () => {
      if (document.visibilityState !== 'visible') return;
      onlineAgora(min)
        .then((r) => vivo && setD(r))
        .catch(() => {});
    };
    carregar();
    const id = window.setInterval(carregar, 30000);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [min]);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#16A34A]" />
          </span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Agora no site</h2>
            <p className="font-sans text-[34px] font-bold leading-none tabular-nums">
              {d ? d.total.toLocaleString('pt-BR') : '…'}
              <span className="ml-2 text-sm font-semibold text-[var(--text-muted)]">{d?.total === 1 ? 'pessoa' : 'pessoas'} nos últimos {min} min</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {[5, 10, 30].map((m) => (
            <button key={m} type="button" onClick={() => setMin(m)} className={`rounded-full px-3 py-1.5 text-sm ${min === m ? 'bg-ink font-semibold text-white' : 'bg-[var(--pill-bg)]'}`}>
              {m} min
            </button>
          ))}
          <button type="button" onClick={() => setAberto((a) => !a)} className="ml-1 rounded-full px-3 py-1.5 text-sm font-semibold text-accent">
            {aberto ? 'Esconder páginas' : 'Ver páginas'}
          </button>
        </div>
      </div>
      {aberto && d && (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Onde estão agora</h3>
            {d.paginas.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Ninguém no site neste momento.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {d.paginas.map((p) => (
                  <li key={p.pagina} className="flex items-center justify-between gap-3 py-2">
                    <a href={p.pagina} target="_blank" rel="noopener" className="min-w-0">
                      <span className="block truncate text-sm font-semibold hover:text-accent">{p.nome}</span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">{p.pagina}</span>
                    </a>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-bold text-[#166534]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                      {p.n}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {d.origens.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">De onde vieram</h3>
              <ul className="flex flex-col gap-1.5 text-sm">
                {d.origens.map((o) => (
                  <li key={o.nome} className="flex justify-between">
                    <span className="truncate">{o.nome}</span>
                    <span className="font-bold tabular-nums">{o.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Atualiza sozinho a cada 30 segundos{d ? ` · última às ${new Date(d.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}. A equipe logada não aparece.
      </p>
    </section>
  );
}

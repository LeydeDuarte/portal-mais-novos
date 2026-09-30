'use client';

import { useEffect, useState } from 'react';
import { registrarLeituraNoticia } from '@/lib/news/leitura';

/** Barra de progresso de leitura + conta 1 leitura por sessão do navegador */
export function ProgressoLeitura({ id }: { id: string }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const chave = `mnn-lida-${id}`;
    try {
      if (!sessionStorage.getItem(chave)) {
        sessionStorage.setItem(chave, '1');
        registrarLeituraNoticia(id).catch(() => {});
      }
    } catch {
      /* navegador sem sessionStorage */
    }
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setP(h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [id]);
  return (
    <div className="fixed inset-x-0 top-0 z-[95] h-1 bg-transparent" aria-hidden>
      <div className="h-1 bg-accent transition-[width] duration-150" style={{ width: `${p}%` }} />
    </div>
  );
}

export function Compartilhar({ url, titulo }: { url: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${titulo}\n${url}`)}`}
        target="_blank"
        rel="noopener"
        aria-label="Compartilhar no WhatsApp"
        className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] text-[#1BA84F] hover:bg-[var(--pill-bg)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
      </a>
      <button
        type="button"
        aria-label="Copiar link"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          } catch {
            /* sem permissão */
          }
        }}
        className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] hover:bg-[var(--pill-bg)]"
      >
        {copiado ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A7F37" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
            <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
          </svg>
        )}
      </button>
    </div>
  );
}

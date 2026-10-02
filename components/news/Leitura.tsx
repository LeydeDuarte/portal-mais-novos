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

export function Compartilhar({ url, titulo, refId, rotulo = false }: { url: string; titulo: string; refId?: string; rotulo?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const [nativo, setNativo] = useState(false);
  useEffect(() => setNativo(typeof navigator !== 'undefined' && !!navigator.share), []);
  return (
    <div className="flex items-center gap-2">
      {rotulo && <span className="text-[13px] font-semibold text-[var(--text-muted)]">Compartilhar</span>}
      {nativo && (
        // celular: abre o menu de compartilhar do próprio aparelho (WhatsApp, Instagram, e-mail...)
        <button
          type="button"
          aria-label="Compartilhar"
          data-rastro="compartilhar"
          data-rastro-ref={refId}
          onClick={() => navigator.share({ title: titulo, url }).catch(() => {})}
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] hover:bg-[var(--pill-bg)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <path d="m16 6-4-4-4 4M12 2v13" />
          </svg>
        </button>
      )}
      <button
        type="button"
        aria-label="Copiar link"
        data-rastro="compartilhar"
        data-rastro-ref={refId}
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

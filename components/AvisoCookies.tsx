'use client';

import { useEffect, useState } from 'react';

// Aviso de cookies (LGPD). "Aceitar" libera Analytics e pixels de anúncio (Modo de
// Consentimento do Google); "Só os necessários" mantém o site funcionando sem rastreamento.
// A escolha fica guardada por 1 ano no cookie mn_consent.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function AvisoCookies() {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    if (!/(?:^|; )mn_consent=/.test(document.cookie)) setMostrar(true);
  }, []);
  const escolher = (aceitou: boolean) => {
    document.cookie = `mn_consent=${aceitou ? 'sim' : 'nao'}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax; secure`;
    const v = aceitou ? 'granted' : 'denied';
    window.gtag?.('consent', 'update', { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v });
    setMostrar(false);
  };
  if (!mostrar) return null;
  return (
    <div role="dialog" aria-label="Aviso de cookies" className="fixed inset-x-3 bottom-3 z-[95] mx-auto flex max-w-[720px] flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 shadow-2xl md:flex-row md:items-center">
      <p className="flex-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
        Usamos cookies para o site funcionar, entender como ele é usado e mostrar anúncios relevantes. Você escolhe.{' '}
        <a href="/termos" className="font-semibold text-accent underline">
          Saiba mais
        </a>
      </p>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => escolher(false)} className="h-10 flex-1 rounded-full border border-[var(--border)] px-4 text-[13px] font-semibold md:flex-none">
          Só os necessários
        </button>
        <button type="button" onClick={() => escolher(true)} className="h-10 flex-1 rounded-full bg-accent px-4 text-[13px] font-bold text-white md:flex-none">
          Aceitar
        </button>
      </div>
    </div>
  );
}

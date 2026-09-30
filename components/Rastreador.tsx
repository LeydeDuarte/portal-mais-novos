'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Conta as visitas (uma por página aberta) e os cliques em elementos marcados com
// data-rastro="tipo" (e data-rastro-ref="id"). Só é incluído para quem não é da equipe.
export default function Rastreador() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith('/dashboard')) return;
    const corpo = JSON.stringify({ t: 'visita', p: pathname, o: document.referrer || undefined });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon('/api/ev', new Blob([corpo], { type: 'text/plain' }));
      else fetch('/api/ev', { method: 'POST', body: corpo, keepalive: true }).catch(() => {});
    } catch {
      /* ignora */
    }
  }, [pathname]);
  useEffect(() => {
    const clique = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-rastro]') as HTMLElement | null;
      if (!el) return;
      const corpo = JSON.stringify({ t: el.dataset.rastro, p: window.location.pathname, r: el.dataset.rastroRef });
      try {
        if (navigator.sendBeacon) navigator.sendBeacon('/api/ev', new Blob([corpo], { type: 'text/plain' }));
      } catch {
        /* ignora */
      }
    };
    document.addEventListener('click', clique, true);
    return () => document.removeEventListener('click', clique, true);
  }, []);
  return null;
}

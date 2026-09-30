'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Conta as visitas (uma por página aberta) e os cliques em elementos marcados com
// data-rastro="tipo" (e data-rastro-ref="id"). Só é incluído para quem não é da equipe.
const enviar = (corpo: object) => {
  try {
    const txt = JSON.stringify(corpo);
    if (navigator.sendBeacon) navigator.sendBeacon('/api/ev', new Blob([txt], { type: 'text/plain' }));
    else fetch('/api/ev', { method: 'POST', body: txt, keepalive: true }).catch(() => {});
  } catch {
    /* ignora */
  }
};

export default function Rastreador() {
  const pathname = usePathname();
  // tempo na página: soma só os trechos com a aba visível
  const tempo = useRef<{ p: string | null; soma: number; desde: number | null }>({ p: null, soma: 0, desde: null });
  const fecharTempo = () => {
    const t = tempo.current;
    if (!t.p) return;
    const total = t.soma + (t.desde ? Date.now() - t.desde : 0);
    const seg = Math.round(total / 1000);
    if (seg >= 2) enviar({ t: 'tempo', p: t.p, v: Math.min(seg, 1800) });
    tempo.current = { p: null, soma: 0, desde: null };
  };
  useEffect(() => {
    if (!pathname || pathname.startsWith('/dashboard')) return;
    fecharTempo();
    tempo.current = { p: pathname, soma: 0, desde: document.visibilityState === 'visible' ? Date.now() : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => {
    const vis = () => {
      const t = tempo.current;
      if (document.visibilityState === 'hidden') {
        if (t.desde) t.soma += Date.now() - t.desde;
        t.desde = null;
        fecharTempo(); // celular pode fechar a aba sem aviso: envia já
      } else if (t.p === null && window.location.pathname === pathname) {
        tempo.current = { p: pathname, soma: 0, desde: Date.now() };
      } else if (!t.desde) {
        t.desde = Date.now();
      }
    };
    const sair = () => fecharTempo();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', sair);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', sair);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
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
  // sinal de "online" a cada 1 minuto, só com a página visível
  useEffect(() => {
    if (!pathname || pathname.startsWith('/dashboard')) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') enviar({ t: 'ping', p: window.location.pathname });
    }, 60000);
    return () => window.clearInterval(id);
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

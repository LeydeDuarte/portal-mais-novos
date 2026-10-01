'use client';

import { useEffect } from 'react';

// Os cards (feed, regiões, construtoras, relacionados…) surgem suavemente conforme
// a pessoa rola a tela. Um único observador para a página inteira; cards novos
// (rolagem infinita) entram sozinhos. Sem JavaScript, tudo aparece normal.
export default function SurgirAoRolar() {
  useEffect(() => {
    const html = document.documentElement;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    html.classList.add('js-surgir');
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            e.target.classList.add('visto');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 }
    );
    const observar = () => document.querySelectorAll('.surgir:not(.visto):not([data-surgir])').forEach((el) => {
      (el as HTMLElement).dataset.surgir = '1';
      io.observe(el);
    });
    observar();
    let agendado = false;
    const mo = new MutationObserver(() => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(() => {
        agendado = false;
        observar();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      html.classList.remove('js-surgir');
    };
  }, []);
  return null;
}

'use client';

// Mapa real (ruas e nomes) usado como fundo: atrás do desenho do sol e no cartão de
// Localização. MapLibre + OpenFreeMap (gratuito). Parado (sem arrastar). Só carrega
// quando aparece na tela e depois que a página terminou de abrir, para não pesar.
// Atenção: o MapLibre põe "position: relative" no elemento do mapa; por isso o mapa
// fica num div INTERNO (h-full), e o externo é que ocupa o espaço (absolute).
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

const ESTILO = 'https://tiles.openfreemap.org/styles/positron';

export default function MapaFundoSol({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const externo = useRef<HTMLDivElement | null>(null);
  const caixa = useRef<HTMLDivElement | null>(null);
  const [liberado, setLiberado] = useState(false);

  useEffect(() => {
    const el = externo.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const depoisDeCarregar = (fn: () => void) => {
      if (document.readyState === 'complete') timer = setTimeout(fn, 600);
      else window.addEventListener('load', () => (timer = setTimeout(fn, 600)), { once: true });
    };
    const obs = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          obs.disconnect();
          depoisDeCarregar(() => setLiberado(true));
        }
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!liberado || !caixa.current) return;
    let mapa: { remove: () => void } | null = null;
    let cancelado = false;
    (async () => {
      const mod = await import('maplibre-gl');
      const L = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      if (cancelado || !caixa.current) return;
      mapa = new L.Map({
        container: caixa.current,
        style: ESTILO,
        center: [lng, lat],
        zoom,
        interactive: false,
        attributionControl: { compact: true }
      });
    })();
    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [liberado, lat, lng, zoom]);

  return (
    <div ref={externo} className="absolute inset-0 bg-[#EEF0EB]" aria-hidden>
      <div ref={caixa} className="h-full w-full" />
    </div>
  );
}

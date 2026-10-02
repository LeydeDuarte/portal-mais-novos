'use client';

// Mapa real (ruas e nomes) atrás do desenho do sol, para o visitante entender a
// posição do prédio. MapLibre + OpenFreeMap (gratuito). Parado (sem arrastar), e só
// carrega quando a seção aparece na tela, para não pesar a abertura da página.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

const ESTILO = 'https://tiles.openfreemap.org/styles/positron';

export default function MapaFundoSol({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const caixa = useRef<HTMLDivElement | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          setVisivel(true);
          obs.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel || !caixa.current) return;
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
  }, [visivel, lat, lng, zoom]);

  return <div ref={caixa} className="absolute inset-0 bg-[#EEF0EB]" aria-hidden />;
}

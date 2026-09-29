'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FeedItem } from '@/lib/actions';

// Espaço de destaque (2 colunas, ou 2 colunas e 2 linhas). Sem etiqueta "Destaque":
// no nosso portal o destaque é mostrado só pelo tamanho do card.
// mostra um dos anúncios/condomínios marcados
// como destaque pela equipe, entre os que combinam com a busca e o perfil de quem
// está vendo. Troca a cada ~30 s e também quando o espaço volta a aparecer na tela
// (a pessoa rolou e voltou). Cada espaço do feed começa num destaque diferente.
export default function DestaqueRotativo({
  pool,
  inicio,
  render
}: {
  pool: FeedItem[];
  inicio: number;
  render: (item: FeedItem) => ReactNode;
}) {
  const [idx, setIdx] = useState(inicio % Math.max(pool.length, 1));
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useRef(false);

  useEffect(() => {
    if (pool.length < 2) return;
    const t = setInterval(() => {
      if (visivel.current && document.visibilityState === 'visible') setIdx((i) => (i + 1) % pool.length);
    }, 30000);
    return () => clearInterval(t);
  }, [pool.length]);

  useEffect(() => {
    const el = ref.current;
    if (!el || pool.length < 2) return;
    let jaSaiu = false;
    const io = new IntersectionObserver(
      ([e]) => {
        visivel.current = e.isIntersecting;
        if (!e.isIntersecting) jaSaiu = true;
        else if (jaSaiu) {
          jaSaiu = false;
          setIdx((i) => (i + 1) % pool.length); // voltou para a tela: próximo destaque
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pool.length]);

  const item = pool[idx % Math.max(pool.length, 1)];
  if (!item) return null;
  return (
    <div ref={ref} className="relative">
      <div key={idx} className="feed-troca">
        {render(item)}
      </div>
    </div>
  );
}

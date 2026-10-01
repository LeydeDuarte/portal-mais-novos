'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Grade do feed com dois formatos, escolhidos pela pessoa:
//  - "masonry": cada card na altura da sua foto (estilo Pinterest);
//  - "alinhado": fotos no mesmo formato, cards em linhas retas.
// Nos dois, um item pode ocupar 2 colunas (destaques e publis largas).
// O masonry usa CSS Grid com linhas de 8 px: cada card mede a própria altura
// (um único ResizeObserver para todos) e ocupa as linhas que precisa. Sem
// re-render do React ao medir: o estilo é aplicado direto no elemento.
export type ItemGrade = { chave: string; largo?: boolean; alto?: boolean; estimativa?: number; node: ReactNode };

const LINHA = 8; // px

export default function FeedGrid({ itens, modo }: { itens: ItemGrade[]; modo: 'masonry' | 'alinhado' }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grade = ref.current;
    if (!grade) return;
    if (modo !== 'masonry') {
      grade.querySelectorAll<HTMLElement>('[data-feed-item]').forEach((el) => (el.style.gridRowEnd = ''));
      return;
    }
    const ajustar = (el: HTMLElement) => {
      const conteudo = el.firstElementChild as HTMLElement | null;
      if (!conteudo) return;
      const h = conteudo.getBoundingClientRect().height;
      if (h > 0) el.style.gridRowEnd = `span ${Math.ceil(h / LINHA)}`;
    };
    const ro = new ResizeObserver((entradas) => {
      for (const e of entradas) {
        const item = (e.target as HTMLElement).parentElement;
        if (item) ajustar(item);
      }
    });
    const observar = () =>
      grade.querySelectorAll<HTMLElement>('[data-feed-item]').forEach((el) => {
        if (el.dataset.obs) return;
        el.dataset.obs = '1';
        ajustar(el);
        if (el.firstElementChild) ro.observe(el.firstElementChild);
      });
    observar();
    // itens novos (rolagem infinita) entram sem recriar o observador
    const mo = new MutationObserver(observar);
    mo.observe(grade, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      grade.querySelectorAll<HTMLElement>('[data-feed-item]').forEach((el) => delete el.dataset.obs);
    };
  }, [modo]);

  return (
    <div
      ref={ref}
      data-modo={modo}
      className={`feed-grade grid grid-flow-row-dense grid-cols-2 gap-x-2.5 px-2.5 pb-16 pt-2.5 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] sm:gap-x-3 sm:px-5 md:gap-x-4 md:px-6 xl:gap-x-[18px] ${
        modo === 'masonry' ? 'auto-rows-[8px]' : 'items-start'
      }`}
    >
      {itens.map((i) => (
        <div
          key={i.chave}
          data-feed-item
          className={i.alto ? `feed-largo feed-grande col-span-2 ${modo === 'alinhado' ? 'row-span-2' : ''}` : i.largo ? 'feed-largo col-span-2' : ''}
          // antes de medir (1ª pintura), uma altura estimada evita cards sobrepostos
          style={modo === 'masonry' && i.estimativa ? { gridRowEnd: `span ${Math.ceil(i.estimativa / LINHA)}` } : undefined}
        >
          <div className="flow-root">{i.node}</div>
        </div>
      ))}
    </div>
  );
}

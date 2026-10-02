'use client';

// "Imóveis à venda em [cidade do visitante]" embaixo dos indicadores. A página é
// guardada em cache para todos; a troca pela cidade de quem está vendo acontece aqui,
// no navegador. Antes de chegar a resposta, mostra os destaques gerais.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import RelatedListings from '@/components/RelatedListings';
import type { PropertyDetail } from '@/lib/property-details';

// cidade/uf: numa página de região do News, os imóveis são dessa cidade (e não da de quem vê)
export default function ImoveisDaRegiao({ inicial, cidade: cidadeDaPagina, uf: ufDaPagina }: { inicial: PropertyDetail[]; cidade?: string | null; uf?: string | null }) {
  const [itens, setItens] = useState(inicial);
  const [cidade, setCidade] = useState<{ nome: string; uf: string } | null>(null);
  const [textos, setTextos] = useState<{ titulo: string; subtitulo: string } | null>(null);
  useEffect(() => {
    const q = cidadeDaPagina ? `?cidade=${encodeURIComponent(cidadeDaPagina)}${ufDaPagina ? `&uf=${ufDaPagina}` : ''}` : '';
    fetch(`/api/news/imoveis-regiao${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { cidade: string | null; uf: string | null; titulo: string; subtitulo: string; itens: PropertyDetail[] } | null) => {
        if (!j?.itens?.length) return;
        setItens(j.itens);
        setTextos({ titulo: j.titulo, subtitulo: j.subtitulo });
        if (j.cidade && j.uf) setCidade({ nome: j.cidade, uf: j.uf });
      })
      .catch(() => {});
  }, [cidadeDaPagina, ufDaPagina]);
  if (!itens.length) return null;
  const q = cidade ? `?q=${encodeURIComponent(cidade.nome)}` : '';
  return (
    <section className="rounded-3xl bg-[var(--pill-bg)] p-5 md:p-8 [&>section]:mt-0">
      <RelatedListings
        grade
        title={textos?.titulo ?? 'Imóveis à venda'}
        subtitle={textos?.subtitulo ?? 'Escolhidos pela equipe. Muda a cada visita.'}
        items={itens}
      />
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/${q}`} className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white hover:brightness-110">
          {cidade ? `Veja os imóveis à venda em ${cidade.nome} →` : 'Veja os imóveis à venda →'}
        </Link>
        <Link href={`/lancamentos${q}`} className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-5 py-2.5 text-sm font-semibold hover:border-accent">
          Lançamentos e condomínios
        </Link>
        <Link
          href={cidade ? `/mapa?cidade=${encodeURIComponent(cidade.nome)}&uf=${cidade.uf}` : '/mapa'}
          className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-5 py-2.5 text-sm font-semibold hover:border-accent"
        >
          Ver no mapa
        </Link>
      </div>
    </section>
  );
}

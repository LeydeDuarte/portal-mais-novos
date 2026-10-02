'use client';

// "Imóveis à venda em [cidade do visitante]" embaixo dos indicadores. A página é
// guardada em cache para todos; a troca pela cidade de quem está vendo acontece aqui,
// no navegador. Antes de chegar a resposta, mostra os destaques gerais.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import RelatedListings from '@/components/RelatedListings';
import type { PropertyDetail } from '@/lib/property-details';

export default function ImoveisDaRegiao({ inicial }: { inicial: PropertyDetail[] }) {
  const [itens, setItens] = useState(inicial);
  const [cidade, setCidade] = useState<{ nome: string; uf: string } | null>(null);
  useEffect(() => {
    fetch('/api/news/imoveis-regiao')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { cidade: string | null; uf: string | null; itens: PropertyDetail[] } | null) => {
        if (!j?.itens?.length) return;
        setItens(j.itens);
        if (j.cidade && j.uf) setCidade({ nome: j.cidade, uf: j.uf });
      })
      .catch(() => {});
  }, []);
  if (!itens.length) return null;
  const q = cidade ? `?q=${encodeURIComponent(cidade.nome)}` : '';
  return (
    <section className="rounded-3xl bg-[var(--pill-bg)] p-5 md:p-8 [&>section]:mt-0">
      <RelatedListings
        grade
        title={cidade ? `Imóveis à venda em ${cidade.nome}` : 'Imóveis à venda'}
        subtitle={cidade ? 'Perto de você. Muda a cada visita.' : 'Escolhidos pela equipe. Muda a cada visita.'}
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

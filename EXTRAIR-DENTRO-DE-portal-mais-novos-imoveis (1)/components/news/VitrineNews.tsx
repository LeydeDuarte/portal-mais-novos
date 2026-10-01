// Vitrine do Mais Novos News nas páginas de imóvel e condomínio: últimas notícias do
// mercado, priorizando o bairro e a cidade do imóvel. Leva o visitante para o News.
import Link from 'next/link';
import { CardNoticia } from './Pecas';
import { noticiasParaLugar } from '@/lib/news/dados';

export default async function VitrineNews({ bairro, cidade }: { bairro?: string | null; cidade?: string | null }) {
  const itens = await noticiasParaLugar(bairro, cidade, 4);
  if (!itens.length) return null;
  return (
    <section className="mt-12 rounded-3xl bg-[var(--pill-bg)] p-5 md:p-8" aria-label="Últimas notícias do Mais Novos News">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/news" className="flex items-baseline gap-1.5">
            <span className="font-serif text-[24px] font-bold tracking-tight md:text-[28px]">Mais Novos</span>
            <span className="font-serif text-[24px] italic text-accent md:text-[28px]">News</span>
          </Link>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">Últimas notícias do mercado de imóveis{bairro ? `, com o que acontece no ${bairro}` : cidade ? ` em ${cidade}` : ''}.</p>
        </div>
        <Link href="/news" className="text-sm font-semibold text-accent">
          Ver todas as notícias →
        </Link>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {itens.map((n) => (
          <CardNoticia key={n.id} n={n} />
        ))}
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SITE_URL } from '@/lib/seo';
import { MAIS_VALOR_URL } from '@/lib/marca';

export const metadata: Metadata = {
  title: 'Financiamento imobiliário e home equity em Goiânia',
  description:
    'Financiamento imobiliário, crédito com garantia de imóvel (home equity) e estruturação de crédito com a Mais Valor Capital: mais de 15 bancos e fundos parceiros e prazos de até 420 meses.',
  alternates: { canonical: `${SITE_URL}/financiamento` }
};

const ITENS = [
  { t: 'Financiamento imobiliário', d: 'Comparamos as condições de vários bancos para você comprar com a melhor taxa e a parcela que cabe no seu planejamento.' },
  { t: 'Home equity (crédito com garantia de imóvel)', d: 'Use o imóvel que você já tem para conseguir crédito com juros menores e prazo longo, para investir, quitar dívidas ou crescer.' },
  { t: 'Estruturação de crédito', d: 'Organizamos a sua documentação e o seu perfil de crédito antes da análise do banco, o que aumenta a chance de aprovação.' },
  { t: 'Brasileiros no exterior', d: 'Atendimento a distância para quem mora fora e quer comprar ou financiar um imóvel no Brasil com segurança.' }
];

export default function FinanciamentoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Crédito imobiliário</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight">Financiamento imobiliário e home equity em Goiânia</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-muted)]">
          O crédito da Mais Novos Imóveis é feito pela <strong className="text-[var(--text)]">Mais Valor Capital</strong>, a nossa marca de crédito:
          mais de 15 bancos e fundos parceiros, prazos de até 420 meses e assessoria sem taxa inicial.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {ITENS.map((i) => (
            <div key={i.t} className="rounded-2xl border border-[var(--border)] p-5">
              <h2 className="text-lg font-bold">{i.t}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-muted)]">{i.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={MAIS_VALOR_URL} target="_blank" rel="noopener" className="rounded-full bg-[#0F1E3D] px-6 py-3 text-sm font-bold text-white hover:opacity-90">
            Falar com a Mais Valor Capital →
          </a>
          <Link href="/" className="rounded-full border border-[var(--border)] px-6 py-3 text-sm font-bold hover:bg-[var(--pill-bg)]">
            Ver imóveis à venda
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

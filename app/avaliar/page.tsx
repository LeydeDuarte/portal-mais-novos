import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FormAvaliacao from '@/components/FormAvaliacao';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: 'Quanto Vale Meu Imóvel? Avaliação Grátis em Goiânia' },
  description: 'Descubra quanto vale o seu imóvel com a avaliação pelo método comparativo da NBR 14653-2, usando anúncios parecidos da sua região. Grátis e na hora.',
  alternates: { canonical: `${SITE_URL}/avaliar` }
};

export default function AvaliarPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-5 pb-20 pt-8 md:px-8">
        <h1 className="font-serif text-[30px] font-semibold leading-tight md:text-[42px]">Quanto vale o seu imóvel hoje?</h1>
        <p className="mt-2 max-w-[680px] text-[17px] leading-relaxed text-[var(--text-muted)]">
          Uma estimativa feita com o método comparativo da norma de avaliação de imóveis (ABNT NBR 14653-2): comparamos o seu imóvel com anúncios parecidos da mesma região e ajustamos as diferenças.
        </p>
        <FormAvaliacao />
      </main>
      <Footer />
    </div>
  );
}

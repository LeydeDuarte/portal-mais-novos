import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FormVender from '@/components/FormVender';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Venda seu imóvel em Goiânia',
  description:
    'Quer vender seu imóvel em Goiânia? Informe o CEP, as características básicas e seu contato. A equipe da Mais Novos Imóveis avalia e divulga com fotos, vídeo e atendimento especializado em crédito.',
  alternates: { canonical: `${SITE_URL}/vender` },
  openGraph: { title: `Venda seu imóvel | ${SITE_NAME}`, url: `${SITE_URL}/vender`, siteName: SITE_NAME, locale: 'pt_BR', type: 'website' }
};

const PASSOS = [
  { t: 'Você conta o básico', d: 'CEP, tipo, tamanho e o valor que imagina. Leva um minuto.' },
  { t: 'A gente liga', d: 'Conversamos sobre o imóvel, documentação e o melhor preço para o mercado atual.' },
  { t: 'Divulgação completa', d: 'Fotos, vídeo, página própria no portal e compradores já com crédito analisado.' }
];

export default function VenderPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-10 md:grid-cols-[1fr_1.2fr] md:px-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold leading-tight md:text-4xl">Quer vender seu imóvel?</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">
            Cadastre as características básicas e seu contato. Nossa equipe entra em contato para avaliar e cuidar da venda, inclusive da parte de
            financiamento do comprador.
          </p>
          <ol className="mt-7 flex flex-col gap-5">
            {PASSOS.map((p, i) => (
              <li key={p.t} className="flex gap-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">{i + 1}</span>
                <span>
                  <span className="block font-bold">{p.t}</span>
                  <span className="text-sm text-[var(--text-muted)]">{p.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <FormVender />
      </main>
      <Footer />
    </div>
  );
}

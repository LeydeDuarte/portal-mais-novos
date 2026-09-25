import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { EMPRESA, SITE_NAME, SITE_URL } from '@/lib/seo';
import { MAIS_VALOR_URL } from '@/lib/marca';

export const metadata: Metadata = {
  title: 'Quem somos',
  description:
    'Mais Novos Imóveis: portal e imobiliária em Goiânia que une imóveis selecionados, vídeos e estratégia de crédito. Conheça a Leyde Duarte e a Mais Valor Capital.',
  alternates: { canonical: `${SITE_URL}/quem-somos` }
};

const PILARES = [
  {
    titulo: 'Imóveis que você vê de verdade',
    texto:
      'Nosso feed foi pensado para inspirar: fotos grandes, vídeos que tocam sozinhos e as informações que importam logo de cara: condomínio, metragem, quartos, idade do imóvel e valor do m². Nenhum outro portal de Goiânia mostra imóveis assim.'
  },
  {
    titulo: 'Curadoria, não volume',
    texto:
      'Cada anúncio tem história: de qual condomínio faz parte, quando foi entregue, o que o prédio oferece. Lançamentos, imóveis novos, seminovos e oportunidades exclusivas, inclusive anúncios privados, apresentados só a quem busca aquele perfil.'
  },
  {
    titulo: 'Estruturação de ativos imobiliários',
    texto:
      'Comprar um imóvel é uma decisão patrimonial. Por isso olhamos além da visita: financiamento, uso do imóvel como garantia (home equity), organização do crédito e o melhor caminho para o seu patrimônio crescer.'
  },
  {
    titulo: 'Discrição e segurança',
    texto:
      'Respeitamos quem vende e quem compra. Anúncios privados só abrem para quem recebeu o link, as fotos são protegidas e os seus dados são tratados conforme a LGPD.'
  }
];

export default function QuemSomosPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: `${SITE_URL}/quem-somos`,
    name: `Quem somos | ${SITE_NAME}`,
    about: { '@id': `${SITE_URL}/#empresa` },
    mainEntity: {
      '@type': 'Person',
      name: 'Leyde Duarte',
      jobTitle: 'Corretora de imóveis e especialista em crédito imobiliário',
      identifier: EMPRESA.creci,
      worksFor: { '@id': `${SITE_URL}/#empresa` },
      sameAs: [EMPRESA.instagram]
    }
  };
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <JsonLd data={jsonLd} />
      <main className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Quem somos</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight md:text-4xl">
          Mais Novos Imóveis: o jeito mais bonito e mais inteligente de encontrar seu imóvel em Goiânia
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-[var(--text-muted)]">
          Somos um portal e uma imobiliária de Goiânia que nasceu de uma pergunta simples: por que procurar imóvel ainda é tão cansativo? Criamos
          um lugar onde a busca inspira, com vídeos, fotos em destaque e informação clara, e onde cada negócio é tratado como o que ele é: uma
          decisão sobre o seu patrimônio.
        </p>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {PILARES.map((p) => (
            <div key={p.titulo} className="rounded-2xl border border-[var(--border)] p-5">
              <h2 className="text-lg font-bold">{p.titulo}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-muted)]">{p.texto}</p>
            </div>
          ))}
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold">Quem está por trás</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-[var(--text-muted)]">
            A Mais Novos Imóveis é conduzida por <strong className="text-[var(--text)]">Leyde Duarte</strong>, corretora de imóveis ({EMPRESA.creci})
            e especialista em crédito imobiliário, atuando no mercado desde 2010. Correspondente bancária, Leyde une a leitura do mercado de
            Goiânia ao conhecimento de como os bancos analisam crédito, o que faz diferença na hora de comprar, vender ou usar um imóvel como
            alavanca patrimonial.
          </p>
          <p className="mt-3 text-[16px] leading-relaxed text-[var(--text-muted)]">
            Atendemos quem mora em Goiânia e também brasileiros que vivem no exterior e querem investir ou organizar seu patrimônio imobiliário no
            Brasil com segurança, a distância.
          </p>
        </section>

        <section className="mt-12 overflow-hidden rounded-3xl bg-[#0F1E3D] p-7 text-white md:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Nosso ecossistema</p>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Mais Valor Capital: crédito imobiliário com estratégia</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/80">
            A Mais Valor Capital é a nossa marca de crédito: financiamento imobiliário, crédito com garantia de imóvel (home equity) e estruturação
            do seu perfil de crédito. Trabalhamos com mais de 15 bancos e fundos parceiros, prazos de até 420 meses e assessoria sem taxa inicial,
            para você comprar melhor e fazer o seu patrimônio render mais.
          </p>
          <a
            href={MAIS_VALOR_URL}
            target="_blank"
            rel="noopener"
            className="mt-6 inline-block rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0F1E3D] hover:bg-white/90"
          >
            Conheça a Mais Valor Capital →
          </a>
        </section>

        <section className="mt-12 flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
            Ver imóveis à venda
          </Link>
          <Link href="/lancamentos" className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-bold hover:bg-[var(--pill-bg)]">
            Lançamentos
          </Link>
          <Link href="/imoveis" className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-bold hover:bg-[var(--pill-bg)]">
            Imóveis por bairro
          </Link>
        </section>

        <p className="mt-10 text-xs text-[var(--text-faint)]">
          {EMPRESA.razao} · CNPJ {EMPRESA.cnpj} · {EMPRESA.creci} · {EMPRESA.cidade}/{EMPRESA.uf}
        </p>
      </main>
      <Footer />
    </div>
  );
}

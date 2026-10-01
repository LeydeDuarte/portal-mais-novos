import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import RelatedListings from '@/components/RelatedListings';
import { SugestaoRegiao } from '@/components/news/SeletorRegiao';
import BannerFundadora from '@/components/news/BannerFundadora';
import { Banner, CardNoticia, FaixaIndicadores, MaisLidas, Regioes, TopoNews } from '@/components/news/Pecas';
import { noticiasDaCapa, maisLidas, regioesComNoticias, bannersAtivos, noticiasPublicadas } from '@/lib/news/dados';
import { imoveisEmDestaque } from '@/lib/news/imoveis';
import { lerIndicadores } from '@/lib/indicadores';
import { lancamentosPorIncorporadora, mercadoPorBairro } from '@/lib/news/mercado';
import GraficoIncorporadorasRegiao from '@/components/news/GraficoIncorporadorasRegiao';
import { TOPICOS, urlNoticia, type Noticia } from '@/lib/news/base';

import { SITE_URL, SITE_NAME, urlRegiao as urlRegiaoImoveis } from '@/lib/seo';

// Capa do Mais Novos News. Guardada por 5 minutos (menos consulta ao banco).
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: 'Mais Novos News: Mercado Imobiliário de Goiânia e Região' },
  description: 'Notícias do mercado imobiliário de Goiânia e região: preço do m² por bairro, lançamentos, financiamento, Selic, INCC e o que muda no bolso de quem compra ou vende.',
  alternates: { canonical: `${SITE_URL}/news`, types: { 'application/rss+xml': `${SITE_URL}/news/rss.xml` } },
  openGraph: { title: 'Mais Novos News', description: 'O mercado imobiliário de Goiânia sem enrolação.', url: `${SITE_URL}/news`, siteName: SITE_NAME, locale: 'pt_BR', type: 'website' }
};

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

export default async function NewsCapa({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  const [todas, lidas, regioes, indicadores, destaques, banners, bairros, incorporadoras] = await Promise.all([
    q ? noticiasPublicadas({ q, limite: 40 }) : noticiasDaCapa(),
    maisLidas(30, 5),
    regioesComNoticias(),
    lerIndicadores(13),
    imoveisEmDestaque(4),
    bannersAtivos(),
    mercadoPorBairro('GO', 8),
    lancamentosPorIncorporadora(null, 10, 'GO')
  ]);
  const [principal, ...resto] = todas;
  const secundarias = resto.slice(0, 3);
  const abaixo = q ? [] : resto.slice(3, 5);
  const restoDepois = resto.slice(3 + abaixo.length);
  const porTopico = TOPICOS.map((t) => ({ t, itens: restoDepois.filter((n) => n.topico === t.id).slice(0, 4) })).filter((x) => x.itens.length >= 2);
  const demais = restoDepois.filter((n) => !porTopico.some((x) => x.itens.includes(n))).slice(0, 8);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Mais Novos News',
          url: `${SITE_URL}/news`,
          inLanguage: 'pt-BR',
          publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
          mainEntity: { '@type': 'ItemList', itemListElement: todas.slice(0, 20).map((n: Noticia, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}${urlNoticia(n)}`, name: n.titulo })) }
        }}
      />
      <h1 className="sr-only">Mais Novos News: notícias do mercado imobiliário de Goiânia e região</h1>
      <TopoNews q={q} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-5 pb-16 pt-8 md:px-8">
        {!q && <SugestaoRegiao />}
        {q && (
          <p className="text-sm text-[var(--text-muted)]">
            {todas.length ? `${todas.length} resultado(s) para "${q}".` : `Nada encontrado para "${q}".`} <Link href="/news" className="font-semibold text-accent">Limpar busca</Link>
          </p>
        )}

        {!principal ? (
          <p className="rounded-2xl bg-[var(--pill-bg)] p-6 text-center text-[var(--text-muted)]">As primeiras notícias estão a caminho.</p>
        ) : (
          <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-8">
              <CardNoticia n={principal} variante="principal" />
              {/* abaixo da principal: mais duas notícias e o gráfico das incorporadoras (sem buraco ao lado da coluna) */}
              {abaixo.length > 0 && (
                <div className="grid gap-6 border-t border-[var(--border)] pt-6 md:grid-cols-2">
                  {abaixo.map((n) => (
                    <CardNoticia key={n.id} n={n} variante="linha" />
                  ))}
                </div>
              )}
              <GraficoIncorporadorasRegiao inicial={incorporadoras} />
            </div>
            <aside className="flex flex-col gap-6">
              <MaisLidas itens={lidas.length ? lidas : resto.slice(0, 5)} />
              <Link href="/avaliar" className="group flex flex-col gap-1.5 rounded-2xl border-2 border-accent/30 bg-[#F3F7FF] p-4 hover:border-accent">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">Grátis e na hora</span>
                <span className="font-serif text-[20px] font-semibold leading-snug">Quanto vale o seu imóvel hoje?</span>
                <span className="text-[13px] leading-snug text-[var(--text-muted)]">Avaliação pelo método comparativo da NBR 14653, com os anúncios da sua região.</span>
                <span className="mt-1 inline-flex h-10 w-fit items-center rounded-full bg-accent px-4 text-sm font-bold text-white">Avaliar meu imóvel →</span>
              </Link>
              <BannerFundadora />
              <Regioes lista={regioes} />
              <Banner banners={banners} posicao="lateral" />
            </aside>
          </section>
        )}

        <FaixaIndicadores lista={indicadores} />

        {secundarias.length > 0 && (
          <section className="grid gap-8 border-t border-[var(--border)] pt-8 md:grid-cols-3">
            {secundarias.map((n) => (
              <CardNoticia key={n.id} n={n} />
            ))}
          </section>
        )}

        {destaques.length > 0 && (
          <section className="rounded-3xl bg-[var(--pill-bg)] p-5 md:p-8 [&>section]:mt-0">
            <RelatedListings grade title="Imóveis em destaque" subtitle="Escolhidos pela equipe. Muda a cada visita." items={destaques} />
          </section>
        )}

        {(porTopico.length > 0 || demais.length > 0) && (
          <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex flex-col gap-10">
              {porTopico.map(({ t, itens }) => (
                <div key={t.id} className="flex flex-col gap-4">
                  <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
                    <h2 className="font-serif text-[26px] font-semibold">{t.nome}</h2>
                    <Link href={`/news/${t.id}`} className="text-sm font-semibold text-accent">
                      Tudo sobre {t.nome.toLowerCase()} →
                    </Link>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    {itens.map((n) => (
                      <CardNoticia key={n.id} n={n} variante="linha" />
                    ))}
                  </div>
                </div>
              ))}
              {demais.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h2 className="border-b-2 border-ink pb-2 font-serif text-[26px] font-semibold">Mais notícias</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    {demais.map((n) => (
                      <CardNoticia key={n.id} n={n} variante="linha" />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <aside className="flex flex-col gap-6">
              {/* com poucas notícias, o banner alto deixava buraco: só usa o alto quando a coluna é comprida */}
              <Banner banners={banners} posicao={demais.length + porTopico.length * 4 >= 8 ? 'lateral-grande' : 'lateral'} className="lg:sticky lg:top-24" />
            </aside>
          </section>
        )}

        {bairros.length > 0 && (
          <section className="border-t border-[var(--border)] pt-8">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h2 className="font-serif text-[26px] font-semibold md:text-[30px]">Preço do m² por bairro</h2>
              <span className="text-[13px] text-[var(--text-muted)]">Fonte: Mais Novos Imóveis</span>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-[var(--pill-bg)] text-left">
                  <tr>
                    <th className="p-3">Bairro</th>
                    <th className="p-3">m² médio anunciado</th>
                    <th className="p-3">Em 12 meses</th>
                    <th className="p-3">À venda agora</th>
                  </tr>
                </thead>
                <tbody>
                  {bairros.map((b) => (
                    <tr key={b.nome + b.cidade} className="border-t border-[var(--border)]">
                      <td className="p-3 font-semibold">
                        <Link href={urlRegiaoImoveis({ uf: b.uf, cidade: b.cidade, bairro: b.nome })} className="hover:text-accent">
                          {b.nome}
                        </Link>
                        <span className="block text-xs font-normal text-[var(--text-muted)]">{b.cidade}</span>
                      </td>
                      <td className="p-3 font-sans font-bold tabular-nums">{brl(b.m2)}</td>
                      <td className={`p-3 font-bold ${b.variacao12m == null ? 'font-normal text-[var(--text-muted)]' : b.variacao12m >= 0 ? 'text-[#1A7F37]' : 'text-[#B42318]'}`}>
                        {b.variacao12m == null ? 'em apuração' : `${b.variacao12m > 0 ? '+' : ''}${b.variacao12m.toLocaleString('pt-BR')}%`}
                      </td>
                      <td className="p-3 tabular-nums">{b.anuncios}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Informações coletadas e tratadas em nosso banco de dados próprio.</p>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

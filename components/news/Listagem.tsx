// Listagem de notícias (tópico ou região): título, lista e lateral
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { Banner, CardNoticia, MaisLidas, Regioes, TopoNews } from './Pecas';
import BannerFundadora from './BannerFundadora';
import { bannersAtivos, maisLidas, regioesComNoticias } from '@/lib/news/dados';
import { urlNoticia, type Noticia } from '@/lib/news/base';
import { SITE_URL } from '@/lib/seo';

export default async function Listagem({
  titulo,
  descricao,
  itens,
  ativo,
  regiaoAtual,
  caminho,
  pagina,
  temMais
}: {
  titulo: string;
  descricao: string;
  itens: Noticia[];
  ativo?: string;
  regiaoAtual?: string;
  caminho: string;
  pagina: number;
  temMais: boolean;
}) {
  const [lidas, regioes, banners] = await Promise.all([maisLidas(30, 5), regioesComNoticias(), bannersAtivos()]);
  const [primeira, ...resto] = itens;
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: titulo,
          description: descricao,
          url: `${SITE_URL}${caminho}`,
          inLanguage: 'pt-BR',
          mainEntity: { '@type': 'ItemList', itemListElement: itens.map((n, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}${urlNoticia(n)}`, name: n.titulo })) }
        }}
      />
      <TopoNews ativo={ativo} regiaoAtual={regiaoAtual} />
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          <header>
            <h1 className="font-serif text-[32px] font-semibold leading-tight md:text-[42px]">{titulo}</h1>
            <p className="mt-2 max-w-[680px] text-[16px] leading-relaxed text-[var(--text-muted)]">{descricao}</p>
          </header>
          {!primeira ? (
            <p className="rounded-2xl bg-[var(--pill-bg)] p-6 text-[var(--text-muted)]">Ainda não tem notícia aqui. Volte em breve.</p>
          ) : (
            <>
              {pagina === 0 && <CardNoticia n={primeira} variante="principal" />}
              <div className="grid gap-6 md:grid-cols-2">
                {(pagina === 0 ? resto : itens).map((n) => (
                  <CardNoticia key={n.id} n={n} variante="linha" />
                ))}
              </div>
              <div className="flex gap-3">
                {pagina > 0 && (
                  <Link href={`${caminho}${pagina > 1 ? `?pagina=${pagina}` : ''}`} className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-semibold">
                    ← Mais recentes
                  </Link>
                )}
                {temMais && (
                  <Link href={`${caminho}?pagina=${pagina + 2}`} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
                    Notícias anteriores →
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
        <aside className="flex flex-col gap-6">
          <MaisLidas itens={lidas} />
          <BannerFundadora />
          <Regioes lista={regioes} atual={regiaoAtual} />
          <Banner banners={banners} posicao="lateral" />
        </aside>
      </main>
      <Footer />
    </div>
  );
}

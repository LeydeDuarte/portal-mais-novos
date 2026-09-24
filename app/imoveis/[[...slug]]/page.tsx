import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import Trilha from '@/components/Trilha';
import CardAnuncio from '@/components/CardAnuncio';
import ImagemCapa from '@/components/ImagemCapa';
import { CATEGORIAS, acharRegiao, anunciosDaRegiao, condominiosDaRegiao, listarRegioes, type Estatisticas, type Regiao } from '@/lib/landing';
import { SITE_NAME, SITE_URL, slugify, trilhaDoImovel } from '@/lib/seo';

// Páginas de região para o Google e para buscadores de IA:
//   /imoveis                              → todas as cidades
//   /imoveis/goiania                      → cidade
//   /imoveis/goiania/apartamentos         → categoria na cidade
//   /imoveis/goiania/setor-bueno          → bairro
//   /imoveis/goiania/setor-bueno/casas    → categoria no bairro
export const revalidate = 600;

type Props = { params: { slug?: string[] } };

type Resolvido = { regiao: Regiao | null; cidade: Regiao | null; categoria: string | null; lista: Regiao[] };

async function resolver(slug: string[] = []): Promise<Resolvido | null> {
  const lista = await listarRegioes();
  if (slug.length === 0) return { regiao: null, cidade: null, categoria: null, lista };
  if (slug.length > 3) return null;
  const [c, b, cat] = slug.map((s) => s.toLowerCase());
  const cidade = await acharRegiao(c);
  if (!cidade) return null;
  if (!b) return { regiao: cidade, cidade, categoria: null, lista };
  if (CATEGORIAS[b] && !cat) return cidade.categorias[b] ? { regiao: cidade, cidade, categoria: b, lista } : null;
  const bairro = await acharRegiao(c, b);
  if (!bairro) return null;
  if (cat && (!CATEGORIAS[cat] || !bairro.categorias[cat])) return null;
  return { regiao: bairro, cidade, categoria: cat ?? null, lista };
}

const brl = (v: number | null) =>
  v == null ? '' : v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} milhões` : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function nomes(r: Resolvido) {
  const cat = r.categoria ? CATEGORIAS[r.categoria] : null;
  const o = r.regiao?.bairro ? `no ${r.regiao.bairro}, ${r.regiao.cidade}` : r.regiao ? `em ${r.regiao.cidade}` : 'em Goiânia e região';
  const oQue = cat ? cat.nome : 'Imóveis';
  return { cat, onde: o, titulo: `${oQue} à venda ${o}` };
}

function caminho(r: Resolvido): string {
  if (!r.regiao) return '/imoveis';
  const base = `/imoveis/${slugify(r.regiao.cidade)}${r.regiao.bairro ? `/${slugify(r.regiao.bairro)}` : ''}`;
  return r.categoria ? `${base}/${r.categoria}` : base;
}

/** Texto de abertura com números reais — é o que o Google e as IAs citam */
function textoIntro(r: Resolvido, est: Estatisticas, condos: number): string {
  const { cat, onde } = nomes(r);
  const oQue = cat ? cat.nome.toLowerCase() : 'imóveis';
  const partes = [
    `Encontre ${est.n} ${est.n === 1 ? (cat ? cat.singular : 'imóvel') : oQue} à venda ${onde}${condos ? ` e ${condos} ${condos === 1 ? 'condomínio' : 'condomínios'} com anúncios ou lançamentos` : ''}.`,
    est.min && est.max && est.min !== est.max ? `Os valores vão de ${brl(est.min)} a ${brl(est.max)}.` : est.min ? `Valores a partir de ${brl(est.min)}.` : '',
    est.m2 ? `O preço médio anunciado é de ${brl(est.m2)} por m².` : '',
    est.comVideo ? `${est.comVideo} ${est.comVideo === 1 ? 'anúncio tem' : 'anúncios têm'} vídeo.` : '',
    'Todos com fotos, dados do condomínio e atendimento da Mais Novos Imóveis — inclusive para financiamento e crédito imobiliário.'
  ];
  return partes.filter(Boolean).join(' ');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolver(params.slug);
  if (!r) return { title: 'Página não encontrada', robots: { index: false } };
  const { titulo } = nomes(r);
  const url = `${SITE_URL}${caminho(r)}`;
  let description = `Imóveis à venda em Goiânia e região por bairro: apartamentos, casas em condomínio, coberturas e lançamentos, com fotos e vídeos.`;
  if (r.regiao) {
    const { est } = await anunciosDaRegiao(r.regiao.cidade, r.regiao.bairro, r.categoria, 1);
    description = `${est.n} ${titulo.toLowerCase()}${est.min ? `, a partir de ${brl(est.min)}` : ''}${est.m2 ? ` (média de ${brl(est.m2)}/m²)` : ''}. Veja fotos, vídeos e condomínios na ${SITE_NAME}.`;
  }
  return {
    title: titulo,
    description: description.slice(0, 160),
    alternates: { canonical: url },
    openGraph: { title: `${titulo} | ${SITE_NAME}`, description, url, siteName: SITE_NAME, locale: 'pt_BR', type: 'website' }
  };
}

export default async function RegiaoPage({ params }: Props) {
  const r = await resolver(params.slug);
  if (!r) notFound();

  // /imoveis — lista de cidades e bairros
  if (!r.regiao) {
    const cidades = r.lista.filter((x) => !x.bairro);
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
          <Trilha itens={[{ nome: 'Início', url: SITE_URL }, { nome: 'Imóveis por região', url: `${SITE_URL}/imoveis` }]} />
          <h1 className="font-serif text-3xl font-semibold">Imóveis à venda em Goiânia e região</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--text-muted)]">
            Escolha a cidade e o bairro para ver apartamentos, casas em condomínio, coberturas e lançamentos à venda — com fotos, vídeos e as
            informações de cada condomínio.
          </p>
          {cidades.map((c) => (
            <section key={c.cidade} className="mt-8">
              <h2 className="text-xl font-bold">
                <Link href={`/imoveis/${slugify(c.cidade)}`} className="hover:underline">
                  Imóveis à venda em {c.cidade}
                </Link>{' '}
                <span className="text-sm font-normal text-[var(--text-muted)]">({c.n})</span>
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.lista
                  .filter((b) => b.bairro && b.cidade === c.cidade)
                  .map((b) => (
                    <Link
                      key={b.bairro}
                      href={`/imoveis/${slugify(c.cidade)}/${slugify(b.bairro!)}`}
                      className="rounded-full border border-[var(--border)] px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
                    >
                      {b.bairro} <span className="font-normal text-[var(--text-muted)]">({b.n})</span>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </main>
        <Footer />
      </div>
    );
  }

  const reg = r.regiao;
  const [{ itens, est }, condos] = await Promise.all([
    anunciosDaRegiao(reg.cidade, reg.bairro, r.categoria, 60),
    r.categoria ? Promise.resolve([]) : condominiosDaRegiao(reg.cidade, reg.bairro)
  ]);
  const { titulo, cat } = nomes(r);
  const url = `${SITE_URL}${caminho(r)}`;
  const trilha = [...trilhaDoImovel({ cidade: reg.cidade, bairro: reg.bairro ?? undefined })];
  if (r.categoria) trilha.push({ nome: cat!.nome, url });
  const bairrosDaCidade = !reg.bairro ? r.lista.filter((b) => b.bairro && b.cidade === reg.cidade) : [];
  const baseCat = `/imoveis/${slugify(reg.cidade)}${reg.bairro ? `/${slugify(reg.bairro)}` : ''}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#pagina`,
        name: titulo,
        url,
        inLanguage: 'pt-BR',
        about: { '@type': 'Place', name: reg.bairro ? `${reg.bairro}, ${reg.cidade} - GO` : `${reg.cidade} - GO` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: est.n,
          itemListElement: itens.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/imovel/${p.id}` }))
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: trilha.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.nome, item: t.url }))
      }
    ]
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <JsonLd data={jsonLd} />
      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
        <Trilha itens={trilha} />
        <h1 className="font-serif text-3xl font-semibold">{titulo}</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--text-muted)]">{textoIntro(r, est, condos.length)}</p>

        {/* Categorias com anúncio nesta região */}
        <div className="mt-5 flex flex-wrap gap-2">
          {r.categoria && (
            <Link href={baseCat} className="rounded-full bg-[var(--pill-bg)] px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--border)]">
              ← Todos os imóveis
            </Link>
          )}
          {Object.entries(reg.categorias)
            .filter(([k]) => k !== r.categoria)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => (
              <Link key={k} href={`${baseCat}/${k}`} className="rounded-full border border-[var(--border)] px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent">
                {CATEGORIAS[k].nome} <span className="font-normal text-[var(--text-muted)]">({n})</span>
              </Link>
            ))}
          <Link
            href={`/?q=${encodeURIComponent(reg.bairro ?? reg.cidade)}`}
            className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-bold text-white hover:opacity-90"
          >
            Ver no feed com vídeos →
          </Link>
        </div>

        {itens.length > 0 && (
          <section className="mt-8" aria-label="Anúncios">
            <h2 className="text-lg font-bold">{cat ? cat.nome : 'Imóveis'} à venda</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {itens.map((p, i) => (
                <CardAnuncio key={p.id} p={p} prioridade={i < 4} />
              ))}
            </div>
          </section>
        )}

        {condos.length > 0 && (
          <section className="mt-10" aria-label="Condomínios">
            <h2 className="text-lg font-bold">Condomínios {reg.bairro ? `no ${reg.bairro}` : `em ${reg.cidade}`}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {condos.map((c) => (
                <Link key={c.id} href={`/empreendimento/${c.id}`} className="group flex items-center gap-3 rounded-xl border border-[var(--border)] p-2.5 hover:border-accent">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--card-img-bg)]">
                    {c.capa && <ImagemCapa original={c.capa} alt={`${c.nome} — ${reg.bairro ?? reg.cidade} | ${SITE_NAME}`} className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold group-hover:text-accent">{c.nome}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {c.anuncios ? `${c.anuncios} ${c.anuncios === 1 ? 'anúncio' : 'anúncios'}` : c.entrega && c.entrega > new Date().toISOString().slice(0, 7) ? 'Lançamento' : 'Novo'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {bairrosDaCidade.length > 0 && (
          <section className="mt-10" aria-label="Bairros">
            <h2 className="text-lg font-bold">Bairros de {reg.cidade} com imóveis à venda</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {bairrosDaCidade.map((b) => (
                <Link
                  key={b.bairro}
                  href={`/imoveis/${slugify(reg.cidade)}/${slugify(b.bairro!)}`}
                  className="rounded-full border border-[var(--border)] px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
                >
                  {b.bairro} <span className="font-normal text-[var(--text-muted)]">({b.n})</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

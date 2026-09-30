// Página de uma notícia (usada pela página pública e pela prévia da equipe)
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import RelatedListings from '@/components/RelatedListings';
import BotaoWhatsapp from '@/components/BotaoWhatsapp';
import Corpo, { Inline } from '@/components/news/Corpo';
import BannerFundadora from '@/components/news/BannerFundadora';
import { Banner, CardNoticia, Midia, dataCurta } from '@/components/news/Pecas';
import { Compartilhar, ProgressoLeitura } from '@/components/news/Leitura';
import { relacionadas, bannersAtivos } from '@/lib/news/dados';
import { imoveisParaNoticia } from '@/lib/news/imoveis';
import { blocosDoTexto, focoDaNoticia, minutosLeitura, nomeTopico, textoPuro, urlNoticia, urlRegiao, UFS, type Noticia } from '@/lib/news/base';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export default async function NoticiaView({ n, previa = false }: { n: Noticia; previa?: boolean }) {
  const url = `${SITE_URL}${urlNoticia(n)}`;
  const texto = textoPuro(n.corpo);
  const min = minutosLeitura(texto);
  const indice = blocosDoTexto(n.corpo).filter((b): b is { t: 'h2'; texto: string; id: string } => b.t === 'h2');
  // imóveis na ordem de importância: condomínio citado → bairro → tipo do assunto → destaques
  const foco = focoDaNoticia(n);
  const [rel, banners, imoveis] = await Promise.all([
    relacionadas(n, 4),
    bannersAtivos(),
    imoveisParaNoticia({ empreendimentoId: n.empreendimentoId, bairro: n.bairro, cidade: n.cidade, foco }, 7)
  ]);
  const doBairro = n.bairro || n.empreendimentoId || foco ? imoveis.slice(0, 4) : [];
  const destaques = doBairro.length ? imoveis.slice(4) : imoveis.slice(0, 3);
  const tituloFim = n.bairro
    ? `${foco === 'horizontal' ? 'Casas em condomínio' : foco === 'vertical' ? 'Apartamentos' : foco === 'comercial' ? 'Imóveis comerciais' : 'Imóveis'} à venda no ${n.bairro}`
    : foco === 'horizontal'
      ? 'Casas em condomínio à venda'
      : foco === 'vertical'
        ? 'Apartamentos à venda em vários bairros'
        : foco === 'comercial'
          ? 'Imóveis comerciais à venda'
          : 'Imóveis à venda';
  const whats = {
    titulo: n.titulo,
    caminho: urlNoticia(n),
    condominio: 'Mais Novos News'
  };

  const trilha = [
    { nome: 'News', url: `${SITE_URL}/news` },
    { nome: nomeTopico(n.topico), url: `${SITE_URL}/news/${n.topico}` },
    { nome: n.titulo, url }
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <ProgressoLeitura id={n.id} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'NewsArticle',
              '@id': `${url}#artigo`,
              headline: n.titulo.slice(0, 110),
              description: n.linhaFina ?? texto.slice(0, 160),
              image: n.capa ? [n.capa] : undefined,
              datePublished: n.publicadoEm,
              dateModified: n.atualizadoEm,
              inLanguage: 'pt-BR',
              articleSection: nomeTopico(n.topico),
              keywords: [nomeTopico(n.topico), n.bairro, n.cidade, ...n.tags].filter(Boolean).join(', '),
              wordCount: texto.split(/\s+/).length,
              author: { '@type': 'Person', name: n.autor, jobTitle: 'Corretora de imóveis e especialista em crédito imobiliário', identifier: n.autor === 'Leyde Duarte' ? 'CRECI 17586' : undefined, url: `${SITE_URL}/quem-somos` },
              publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon.png` } },
              mainEntityOfPage: url,
              contentLocation: n.cidade ? { '@type': 'Place', name: [n.bairro, n.cidade, n.uf].filter(Boolean).join(', ') } : undefined,
              isBasedOn: n.fontes.filter((f) => f.url).map((f) => f.url),
              abstract: n.resumo.length ? n.resumo.join(' ') : undefined
            },
            ...(n.faq.length
              ? [{ '@type': 'FAQPage', mainEntity: n.faq.map((f) => ({ '@type': 'Question', name: f.p, acceptedAnswer: { '@type': 'Answer', text: f.r } })) }]
              : []),
            { '@type': 'BreadcrumbList', itemListElement: trilha.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.nome, item: t.url })) }
          ]
        }}
      />

      <main className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-10 pt-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="flex min-w-0 max-w-[760px] flex-col gap-5">
          {previa && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Prévia:</strong> esta notícia está como {n.status === 'agendada' ? 'agendada' : 'rascunho'} e só a equipe vê.{' '}
              <Link href={`/dashboard/news/${n.id}`} className="font-bold underline">
                Editar
              </Link>
            </div>
          )}
          <nav aria-label="Trilha" className="flex flex-wrap gap-1.5 text-[13px] text-[var(--text-muted)]">
            <Link href="/news">News</Link>
            <span>›</span>
            <Link href={`/news/${n.topico}`}>{nomeTopico(n.topico)}</Link>
            {n.uf && (
              <>
                <span>›</span>
                <Link href={urlRegiao(n.uf, n.cidade)}>{n.cidade ?? UFS[n.uf]}</Link>
              </>
            )}
          </nav>
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-accent">
            {nomeTopico(n.topico)}
            {n.bairro ? ` · ${n.bairro}` : ''}
          </span>
          <h1 className="font-serif text-[32px] font-semibold leading-[1.06] tracking-tight md:text-[48px]">{n.titulo}</h1>
          {n.linhaFina && <p className="text-[18px] leading-relaxed text-[var(--text-muted)] md:text-[20px]">{n.linhaFina}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--border)] py-3.5">
            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
              <span className="flex flex-col">
                <Link href="/quem-somos" className="font-bold text-ink">
                  {n.autor}
                </Link>
                <span>{n.autor === 'Leyde Duarte' ? 'Corretora e especialista em crédito · CRECI 17586' : 'Mais Novos News'}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-[13px] text-[var(--text-muted)]">
              <span>
                {dataCurta(n.publicadoEm)}
                {n.atualizadoEm && n.publicadoEm && n.atualizadoEm.slice(0, 10) !== n.publicadoEm.slice(0, 10) ? ` · atualizado em ${dataCurta(n.atualizadoEm)}` : ''} · {min} min
              </span>
              <Compartilhar url={url} titulo={n.titulo} />
            </div>
          </div>

          {(n.capa || n.videoUrl) && (
            <figure className="flex flex-col gap-2">
              <Midia n={n} grande className="aspect-video rounded-[18px]" />
              {n.capaAlt && <figcaption className="text-[13px] text-[var(--text-muted)]">{n.capaAlt}</figcaption>}
            </figure>
          )}

          {n.resumo.length > 0 && (
            <div id="em-30-segundos" className="rounded-2xl bg-[var(--pill-bg)] p-5">
              <h2 className="mb-2 text-xs font-bold tracking-[0.1em]">EM 30 SEGUNDOS</h2>
              <ul className="flex flex-col gap-1.5">
                {n.resumo.map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-[16px] leading-relaxed">
                    <span className="font-bold text-accent">›</span>
                    <span>
                      <Inline texto={r} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Corpo corpo={n.corpo} banners={banners} foco={foco} />

          {n.faq.length > 0 && (
            <section id="perguntas" className="mt-4">
              <h2 className="font-serif text-[26px] font-semibold">Perguntas que sempre aparecem</h2>
              {n.faq.map((f, i) => (
                <details key={i} className="border-b border-[var(--border)] py-3.5" open={i === 0}>
                  <summary className="cursor-pointer text-[17px] font-semibold">{f.p}</summary>
                  <p className="mt-2 text-[16px] leading-relaxed text-[var(--text-muted)]">
                    <Inline texto={f.r} />
                  </p>
                </details>
              ))}
            </section>
          )}

          {n.fontes.length > 0 && (
            <section className="text-[13px] text-[var(--text-muted)]">
              <h2 className="mb-1 font-bold text-ink">Fontes</h2>
              <ul className="flex flex-col gap-0.5">
                {n.fontes.map((f, i) => (
                  <li key={i}>
                    {f.url ? (
                      <a href={f.url} target="_blank" rel="noopener" className="underline">
                        {f.nome}
                      </a>
                    ) : (
                      f.nome
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-col gap-4 rounded-2xl bg-[var(--pill-bg)] p-5 sm:flex-row sm:items-center">
            <div className="flex-1">
              <strong className="text-[16px]">{n.autor}</strong>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                Corretora desde 2010 e especialista em crédito imobiliário. Escreve aqui o que costuma dizer no café com cliente, só que com fonte.
              </p>
            </div>
            <BotaoWhatsapp ctx={whats} variante="pilula" rotulo="Falar com a Leyde" />
          </div>

          <BannerFundadora className="lg:hidden" />

          {doBairro.length > 0 && (
            <div className="[&>section]:mt-4">
              <RelatedListings grade title={tituloFim} items={doBairro} limite={4} />
            </div>
          )}
        </article>

        <aside className="flex flex-col gap-6">
          <div className="flex flex-col gap-6 lg:sticky lg:top-24">
            {indice.length > 1 && (
              <nav aria-label="Nesta notícia" className="flex flex-col gap-2 border-l-2 border-[var(--border)] pl-4 text-sm">
                <span className="text-xs font-bold tracking-[0.1em]">NESTA NOTÍCIA</span>
                {n.resumo.length > 0 && <a href="#em-30-segundos" className="font-semibold">Em 30 segundos</a>}
                {indice.map((h) => (
                  <a key={h.id} href={`#${h.id}`} className="text-[var(--text-muted)] hover:text-ink">
                    {h.texto}
                  </a>
                ))}
                {n.faq.length > 0 && <a href="#perguntas" className="text-[var(--text-muted)] hover:text-ink">Perguntas frequentes</a>}
              </nav>
            )}
            <BannerFundadora className="hidden lg:flex" />
            <Banner banners={banners} posicao="lateral" />
            {destaques.length > 0 && (
              <div className="[&>section]:mt-0 [&_.grid]:grid-cols-1">
                <RelatedListings grade title="Imóveis em destaque" items={destaques} limite={2} />
              </div>
            )}
          </div>
        </aside>
      </main>

      {rel.length > 0 && (
        <section className="bg-[var(--pill-bg)] py-10">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="mb-5 font-serif text-[26px] font-semibold md:text-[30px]">Continue por aqui</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {rel.map((r) => (
                <CardNoticia key={r.id} n={r} />
              ))}
            </div>
          </div>
        </section>
      )}
      <Footer />
    </div>
  );
}

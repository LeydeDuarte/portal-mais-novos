import { fasesDaEmpresa, frasesFases } from '@/lib/empresa-fases';
import { tituloEmpresa } from '@/lib/titulos';
import { imoveisDaEmpresa, nomeCondominioSeo } from '@/lib/seo';
import { urlCondominio } from '@/lib/urls';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DevelopmentCard from '@/components/DevelopmentCard';
import Trilha from '@/components/Trilha';
import JsonLd from '@/components/JsonLd';
import { query } from '@/lib/db';
import { mapEmpresa, type EmpresaRow } from '@/lib/empresas';
import { empreendimentosDaEmpresa } from '@/lib/actions';
import { dataBRCompleta, empresaAtiva, idadeEmpresa, nomeEmpresa, situacaoPublica, type Empresa } from '@/lib/empresas-tipos';
import { BUCKET_LABEL, FASES } from '@/lib/classification';
import { SITE_NAME, SITE_URL } from '@/lib/seo';
import { imagemCartao } from '@/lib/cartao-og';

// Perfil INFORMATIVO da construtora/incorporadora: dados públicos da Receita (situação,
// idade), breve histórico e todos os empreendimentos em que ela participou da
// Concepção, do mais novo para o mais antigo. Não é personalizável pela empresa
// (o "perfil de comunicação" delas virá depois, em domínio próprio).
const POR_PAGINA = 24;

const buscar = cache(async (slug: string) => {
  const r = await query<EmpresaRow>('select e.* from empresas e where e.slug = $1', [decodeURIComponent(slug)]).catch(() => []);
  if (!r[0]) return null;
  const e = mapEmpresa(r[0]);
  // grupo: a principal reúne as empresas ligadas a ela
  const membros = e.grupoPrincipalId
    ? []
    : (await query<EmpresaRow>('select * from empresas where grupo_principal_id = $1::uuid order by coalesce(nome_perfil, nome_fantasia, razao_social)', [e.id]).catch(() => [])).map(mapEmpresa);
  const principal = e.grupoPrincipalId
    ? ((await query<EmpresaRow>('select * from empresas where id = $1::uuid', [e.grupoPrincipalId]).catch(() => [])).map(mapEmpresa)[0] ?? null)
    : null;
  const ids = [e.id, ...membros.map((m) => m.id)];
  const t = await query<{ n: string }>(
    `select count(distinct d.id) as n from development_empresas de join developments d on d.id = de.development_id where de.empresa_id = any($1::uuid[]) and d.status = 'publicado'`,
    [ids]
  ).catch(() => []);
  return { ...e, totalEmpreendimentos: Number(t[0]?.n) || 0, membros, principal, ids };
});

/** Texto do perfil: a história escrita pela equipe ou um resumo automático só com fatos */
function historia(e: Empresa & { membros: Empresa[] }, idade: { anos: number } | null): string {
  if (e.historico?.trim()) return e.historico.trim();
  const nome = nomeEmpresa(e);
  const ano = e.anoFundacao ?? (e.dataInicio ? Number(e.dataInicio.slice(0, 4)) : null);
  const partes = [nome];
  if (e.municipio) partes.push(`, com sede em ${e.municipio}/${e.uf}`);
  if (ano) partes.push(`, atua no mercado imobiliário desde ${ano}${idade && idade.anos > 1 ? ` (${idade.anos} anos)` : ''}`);
  return `${partes.join('')}.`;
}

type Props = { params: { slug: string }; searchParams: { cidade?: string; bairro?: string; fase?: string; tipo?: string; q?: string; pagina?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await buscar(params.slug);
  if (!e) return { title: 'Empresa não encontrada' };
  const nome = nomeEmpresa(e);
  const idade = idadeEmpresa(e.dataInicio, undefined, e.anoFundacao);
  const fases = await fasesDaEmpresa(e.ids);
  const desc = `${nome}: ${e.totalEmpreendimentos ?? 0} empreendimento(s)${e.municipio ? `, sede em ${e.municipio}/${e.uf}` : ''}. ${
    idade ? `Empresa com ${idade.texto} de mercado` : 'Construtora e incorporadora'
  }. Veja lançamentos, obras e prontos do portfólio.`;
  // Padrão de busca: "Imóveis à venda da Incorporadora X"
  const titulo = imoveisDaEmpresa(nome);
  const total = e.totalEmpreendimentos ?? 0;
  const cartaoEmpresa = {
    titulo: nome,
    sub: total ? `${total} ${total === 1 ? 'empreendimento' : 'empreendimentos'}${e.municipio ? `, sede em ${e.municipio}/${e.uf}` : ''}` : e.municipio ? `Sede em ${e.municipio}/${e.uf}` : null,
    selo: 'Construtora'
  };
  return {
    title: { absolute: tituloEmpresa(titulo) },
    // a frase que as pessoas buscam vem primeiro: "conheça todos os empreendimentos da X"
    description: (fases[0]
      ? `Conheça todos os empreendimentos da ${nome} em ${fases[0].cidade}: ${frasesFases(fases[0])}, com plantas, preços e fotos.${idade ? ` ${idade.texto} de mercado.` : ''}`
      : `Conheça todos os empreendimentos da ${nome}, com plantas, preços e fotos.`
    ).slice(0, 160),
    alternates: { canonical: `${SITE_URL}/empresa/${e.slug}` },
    openGraph: {
      title: `${nome} | ${SITE_NAME}`,
      description: desc.slice(0, 200),
      url: `${SITE_URL}/empresa/${e.slug}`,
      siteName: SITE_NAME,
      locale: 'pt_BR',
      type: 'website',
      images: imagemCartao(cartaoEmpresa).images
    },
    twitter: imagemCartao(cartaoEmpresa).twitter
  };
}

export default async function EmpresaPage({ params, searchParams }: Props) {
  const e = await buscar(params.slug);
  if (!e) notFound();
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const filtros = { cidade: searchParams.cidade, bairro: searchParams.bairro, fase: searchParams.fase, tipo: searchParams.tipo, q: searchParams.q };
  const [{ cards, total, cidades, bairros }, fases] = await Promise.all([empreendimentosDaEmpresa(e.ids, filtros, pagina - 1, POR_PAGINA), fasesDaEmpresa(e.ids)]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const nome = nomeEmpresa(e);
  const ativa = empresaAtiva(e);
  const idade = idadeEmpresa(e.dataInicio, undefined, e.anoFundacao);
  const situacao = situacaoPublica(e);
  const filtrando = !!(filtros.cidade || filtros.bairro || filtros.fase || filtros.tipo || filtros.q);
  const link = (pg: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v) sp.set(k, v);
    if (pg > 1) sp.set('pagina', String(pg));
    const qs = sp.toString();
    return `/empresa/${e.slug}${qs ? `?${qs}` : ''}`;
  };
  const sel = 'rounded-full border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-sm';

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': `${SITE_URL}/empresa/${e.slug}#empresa`,
              name: nome,
              ...(e.anoFundacao ? { foundingDate: String(e.anoFundacao) } : e.dataInicio ? { foundingDate: e.dataInicio } : {}),
              ...(e.municipio ? { address: { '@type': 'PostalAddress', addressLocality: e.municipio, addressRegion: e.uf, addressCountry: 'BR' } } : {}),
              url: `${SITE_URL}/empresa/${e.slug}`
            },
            {
              // a página: "Imóveis à venda da Incorporadora X", com a lista dos empreendimentos
              '@type': 'CollectionPage',
              '@id': `${SITE_URL}/empresa/${e.slug}#pagina`,
              name: imoveisDaEmpresa(nome),
              url: `${SITE_URL}/empresa/${e.slug}`,
              inLanguage: 'pt-BR',
              about: { '@id': `${SITE_URL}/empresa/${e.slug}#empresa` },
              mainEntity: {
                '@type': 'ItemList',
                name: imoveisDaEmpresa(nome),
                numberOfItems: total,
                itemListElement: cards.map((c, i) => ({
                  '@type': 'ListItem',
                  position: (pagina - 1) * POR_PAGINA + i + 1,
                  url: `${SITE_URL}${urlCondominio(c)}`,
                  name: `Imóveis à venda no ${nomeCondominioSeo(c.name)}`
                }))
              }
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Construtoras e incorporadoras', item: `${SITE_URL}/empresas` },
                { '@type': 'ListItem', position: 3, name: imoveisDaEmpresa(nome), item: `${SITE_URL}/empresa/${e.slug}` }
              ]
            }
          ]
        }}
      />
      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
        <Trilha itens={[{ nome: 'Início', url: SITE_URL }, { nome: 'Construtoras e incorporadoras', url: `${SITE_URL}/empresas` }, { nome: imoveisDaEmpresa(nome), url: `${SITE_URL}/empresa/${e.slug}` }]} />

        <section className="mt-4 rounded-2xl border border-[var(--border)] p-6">
          <h1 className={`font-serif text-3xl font-semibold ${ativa ? '' : 'text-[var(--text-faint)]'}`}>{nome}</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {situacao && (
              <span className={`rounded-full px-3 py-1 font-bold ${ativa ? 'bg-green-100 text-green-800' : situacao === 'Em recuperação judicial' ? 'bg-amber-100 text-amber-900' : 'bg-[var(--pill-bg)] text-[var(--text-muted)]'}`}>
                {situacao}
              </span>
            )}
            {e.anoFundacao ? (
              <span className="rounded-full bg-[var(--pill-bg)] px-3 py-1 font-semibold">
                Fundada em {e.mesFundacao ? `${String(e.mesFundacao).padStart(2, '0')}/` : ''}{e.anoFundacao}
                {idade ? ` · ${idade.texto}` : ''}
              </span>
            ) : e.dataInicio ? (
              <span className="rounded-full bg-[var(--pill-bg)] px-3 py-1 font-semibold">
                Aberta em {dataBRCompleta(e.dataInicio)}
                {idade ? ` · ${idade.texto}` : ''}
              </span>
            ) : null}
            {e.municipio && (
              <span className="rounded-full bg-[var(--pill-bg)] px-3 py-1 font-semibold">
                Sede: {e.municipio}/{e.uf}
              </span>
            )}
            <span className="rounded-full bg-accent/10 px-3 py-1 font-bold text-accent">{e.totalEmpreendimentos ?? 0} empreendimento(s)</span>
          </div>
          {/* por cidade: quantos em lançamento, em obras e prontos (clique filtra a lista) */}
          {fases.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fases.slice(0, 6).map((f) => (
                <div key={f.cidade + f.uf} className="rounded-2xl border border-[var(--border)] p-4">
                  <p className="text-sm font-bold">
                    {nome} em {f.cidade}
                    <span className="font-normal text-[var(--text-muted)]">/{f.uf}</span>
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">{f.total} empreendimento(s): {frasesFases(f)}.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                    {f.breve > 0 && (
                      <a href={`?cidade=${encodeURIComponent(f.cidade)}&fase=breve_lancamento`} className="rounded-full bg-[#9CC2FF] px-2.5 py-1 text-[#0B2A66]">
                        {f.breve} em breve
                      </a>
                    )}
                    {f.lancamento > 0 && (
                      <a href={`?cidade=${encodeURIComponent(f.cidade)}&fase=lancamento`} className="rounded-full bg-accent px-2.5 py-1 text-white">
                        {f.lancamento} lançamento(s)
                      </a>
                    )}
                    {f.obras > 0 && (
                      <a href={`?cidade=${encodeURIComponent(f.cidade)}&fase=obras`} className="rounded-full bg-[#1E3A8A] px-2.5 py-1 text-white">
                        {f.obras} em obras
                      </a>
                    )}
                    {f.prontos > 0 && (
                      <a href={`?cidade=${encodeURIComponent(f.cidade)}`} className="rounded-full bg-[var(--pill-bg)] px-2.5 py-1">
                        {f.prontos} pronto(s)
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed">{historia(e, idade)}</p>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--text-muted)]">
            Aqui você vê os empreendimentos que fazem parte do portfólio {e.membros.length ? 'desta empresa e das empresas do grupo' : 'desta empresa'}.
          </p>
          {e.membros.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">Empresas do grupo</span>
              {e.membros.map((m) => (
                <Link key={m.id} href={`/empresa/${m.slug}`} className={`rounded-full border border-[var(--border)] px-3 py-1 font-semibold hover:border-accent ${empresaAtiva(m) ? '' : 'text-[var(--text-faint)]'}`}>
                  {nomeEmpresa(m)}
                </Link>
              ))}
            </div>
          )}
          {e.principal && (
            <p className="mt-4 text-sm">
              Faz parte do grupo{' '}
              <Link href={`/empresa/${e.principal.slug}`} className="font-bold text-accent hover:underline">
                {nomeEmpresa(e.principal)}
              </Link>
              .
            </p>
          )}
        </section>

        <h2 className="mt-10 font-serif text-2xl font-semibold">{imoveisDaEmpresa(nome)}</h2>
        <form method="get" className="mt-4 flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={filtros.q ?? ''} placeholder="Nome do empreendimento" className={`${sel} min-w-[200px] flex-1`} />
          {cidades.length > 1 && (
            <select name="cidade" defaultValue={filtros.cidade ?? ''} className={sel}>
              <option value="">Todas as cidades</option>
              {cidades.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          <select name="bairro" defaultValue={filtros.bairro ?? ''} className={sel}>
            <option value="">Todos os bairros</option>
            {bairros.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <select name="fase" defaultValue={filtros.fase ?? ''} className={sel}>
            <option value="">Todas as fases</option>
            {FASES.map((f) => (
              <option key={f} value={f}>
                {BUCKET_LABEL[f]}
              </option>
            ))}
          </select>
          <select name="tipo" defaultValue={filtros.tipo ?? ''} className={sel}>
            <option value="">Vertical e horizontal</option>
            <option value="vertical">Vertical (prédios)</option>
            <option value="horizontal">Horizontal (casas)</option>
          </select>
          <button className="rounded-full bg-ink px-5 py-2 text-sm font-bold text-white">Filtrar</button>
          {filtrando && (
            <Link href={`/empresa/${e.slug}`} className="px-2 text-sm font-semibold text-[var(--text-muted)] hover:underline">
              Limpar
            </Link>
          )}
        </form>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          {total} empreendimento(s){filtrando ? ' nesta busca' : ''}, do mais novo para o mais antigo.
        </p>

        {cards.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum empreendimento encontrado.</p>
        ) : (
          <div className="mt-5 columns-2 gap-2.5 md:columns-3 md:gap-4 lg:columns-4">
            {cards.map((c) => (
              <DevelopmentCard key={c.id} development={c} />
            ))}
          </div>
        )}

        {paginas > 1 && (
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="Páginas">
            {pagina > 1 && (
              <Link href={link(pagina - 1)} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[var(--pill-bg)]">
                ← Anterior
              </Link>
            )}
            {Array.from({ length: paginas }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === paginas || Math.abs(n - pagina) <= 2)
              .map((n, i, arr) => (
                <span key={n} className="flex items-center gap-1.5">
                  {i > 0 && n - arr[i - 1] > 1 && <span className="text-[var(--text-faint)]">…</span>}
                  <Link
                    href={link(n)}
                    className={`flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-bold ${n === pagina ? 'bg-ink text-white' : 'hover:bg-[var(--pill-bg)]'}`}
                  >
                    {n}
                  </Link>
                </span>
              ))}
            {pagina < paginas && (
              <Link href={link(pagina + 1)} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[var(--pill-bg)]">
                Próxima →
              </Link>
            )}
          </nav>
        )}
      </main>
      <Footer />
    </div>
  );
}

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
import { empresaAtiva, formatarCnpj, idadeEmpresa, nomeEmpresa, textoSituacao } from '@/lib/empresas-tipos';
import { BUCKET_LABEL, FASES } from '@/lib/classification';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

// Perfil INFORMATIVO da construtora/incorporadora: dados públicos do CNPJ (situação,
// idade), breve histórico e todos os empreendimentos em que ela participou da
// Concepção, do mais novo para o mais antigo. Não é personalizável pela empresa
// (o "perfil de comunicação" delas virá depois, em domínio próprio).
const POR_PAGINA = 24;

const buscar = cache(async (slug: string) => {
  const r = await query<EmpresaRow>(
    'select e.*, (select count(*) from development_empresas de join developments d on d.id = de.development_id where de.empresa_id = e.id and d.status = \'publicado\') as total from empresas e where e.slug = $1',
    [decodeURIComponent(slug)]
  ).catch(() => []);
  return r[0] ? mapEmpresa(r[0]) : null;
});

type Props = { params: { slug: string }; searchParams: { cidade?: string; bairro?: string; fase?: string; tipo?: string; q?: string; pagina?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await buscar(params.slug);
  if (!e) return { title: 'Empresa não encontrada' };
  const nome = nomeEmpresa(e);
  const idade = idadeEmpresa(e.dataInicio);
  const desc = `${nome}: ${e.totalEmpreendimentos ?? 0} empreendimento(s)${e.municipio ? ` em ${e.municipio}/${e.uf}` : ''}. ${
    idade ? `Empresa com ${idade.texto} de CNPJ` : 'Construtora e incorporadora'
  }${textoSituacao(e) ? `, ${textoSituacao(e)?.toLowerCase()}` : ''}. Veja lançamentos, obras e prontos.`;
  return {
    title: `${nome}: empreendimentos e condomínios`,
    description: desc.slice(0, 160),
    alternates: { canonical: `${SITE_URL}/empresa/${e.slug}` },
    openGraph: { title: `${nome} | ${SITE_NAME}`, description: desc.slice(0, 200), url: `${SITE_URL}/empresa/${e.slug}`, siteName: SITE_NAME, locale: 'pt_BR', type: 'website' }
  };
}

export default async function EmpresaPage({ params, searchParams }: Props) {
  const e = await buscar(params.slug);
  if (!e) notFound();
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const filtros = { cidade: searchParams.cidade, bairro: searchParams.bairro, fase: searchParams.fase, tipo: searchParams.tipo, q: searchParams.q };
  const { cards, total, cidades, bairros } = await empreendimentosDaEmpresa(e.id, filtros, pagina - 1, POR_PAGINA);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const nome = nomeEmpresa(e);
  const ativa = empresaAtiva(e);
  const idade = idadeEmpresa(e.dataInicio);
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
          '@type': 'Organization',
          name: nome,
          legalName: e.razaoSocial,
          ...(e.cnpj ? { taxID: formatarCnpj(e.cnpj) } : {}),
          ...(e.dataInicio ? { foundingDate: e.dataInicio } : {}),
          ...(e.municipio ? { address: { '@type': 'PostalAddress', addressLocality: e.municipio, addressRegion: e.uf, addressCountry: 'BR' } } : {}),
          url: `${SITE_URL}/empresa/${e.slug}`
        }}
      />
      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
        <Trilha itens={[{ nome: 'Início', url: SITE_URL }, { nome: 'Construtoras e incorporadoras', url: `${SITE_URL}/empresas` }, { nome, url: `${SITE_URL}/empresa/${e.slug}` }]} />

        <section className="mt-4 rounded-2xl border border-[var(--border)] p-6">
          <h1 className={`font-serif text-3xl font-semibold ${ativa ? '' : 'text-[var(--text-faint)]'}`}>{nome}</h1>
          <div className="mt-1 text-sm text-[var(--text-muted)]">
            {[e.razaoSocial !== nome ? e.razaoSocial : null, e.cnpj ? `CNPJ ${formatarCnpj(e.cnpj)}` : null].filter(Boolean).join(' · ')}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {textoSituacao(e) && (
              <span className={`rounded-full px-3 py-1 font-bold ${ativa ? 'bg-green-100 text-green-800' : 'bg-[var(--pill-bg)] text-[var(--text-muted)]'}`}>{textoSituacao(e)}</span>
            )}
            {idade && <span className="rounded-full bg-[var(--pill-bg)] px-3 py-1 font-semibold">{idade.texto} de empresa (desde {e.dataInicio!.slice(0, 4)})</span>}
            {e.municipio && (
              <span className="rounded-full bg-[var(--pill-bg)] px-3 py-1 font-semibold">
                Sede: {e.municipio}/{e.uf}
              </span>
            )}
            <span className="rounded-full bg-accent/10 px-3 py-1 font-bold text-accent">{e.totalEmpreendimentos ?? 0} empreendimento(s)</span>
          </div>
          {e.historico ? (
            <p className="mt-4 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed">{e.historico}</p>
          ) : e.atividade ? (
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[var(--text-muted)]">Atividade principal registrada na Receita Federal: {e.atividade}.</p>
          ) : null}
          <p className="mt-4 text-xs text-[var(--text-faint)]">
            {e.cnpj ? `Dados cadastrais públicos da Receita Federal${e.receitaAtualizadaEm ? `, consultados em ${new Date(e.receitaAtualizadaEm).toLocaleDateString('pt-BR')}` : ''}. ` : ''}Perfil
            informativo: reúne os empreendimentos de que a empresa participou para quem vai comprar saber quem fez.
          </p>
        </section>

        <h2 className="mt-10 font-serif text-2xl font-semibold">Empreendimentos e condomínios</h2>
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

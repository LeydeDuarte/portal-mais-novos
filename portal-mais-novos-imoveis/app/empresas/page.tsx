import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { query } from '@/lib/db';
import { mapEmpresa, type EmpresaRow } from '@/lib/empresas';
import { empresaAtiva, idadeEmpresa, nomeEmpresa, situacaoPublica } from '@/lib/empresas-tipos';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Construtoras e incorporadoras de Goiânia',
  description: 'Perfil informativo das construtoras e incorporadoras: situação cadastral, idade da empresa e todos os empreendimentos de cada uma.',
  alternates: { canonical: `${SITE_URL}/empresas` },
  openGraph: { title: `Construtoras e incorporadoras | ${SITE_NAME}`, url: `${SITE_URL}/empresas`, siteName: SITE_NAME, locale: 'pt_BR', type: 'website' }
};

export default async function EmpresasPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const like = `%${q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}%`;
  const rows = await query<EmpresaRow>(
    `select e.*, (select count(*) from development_empresas de join developments d on d.id = de.development_id where de.empresa_id = e.id and d.status = 'publicado') as total
       from empresas e
      where $1 = '' or translate(lower(coalesce(e.nome_perfil, '') || ' ' || coalesce(e.nome_fantasia, '') || ' ' || e.razao_social), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $2
      order by total desc, coalesce(e.nome_perfil, e.nome_fantasia, e.razao_social) limit 300`,
    [q, like]
  ).catch(() => []);
  const empresas = rows.map(mapEmpresa).filter((e) => (e.totalEmpreendimentos ?? 0) > 0 || q);
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8">
        <h1 className="font-serif text-3xl font-semibold">Construtoras e incorporadoras</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-[var(--text-muted)]">
          Saiba quem fez cada empreendimento: situação cadastral na Receita Federal, idade da empresa e o portfólio completo.
        </p>
        <form method="get" className="mt-6 flex gap-2">
          <input name="q" defaultValue={q} placeholder="Buscar construtora ou incorporadora" className="flex-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm" />
          <button className="rounded-full bg-ink px-5 py-2 text-sm font-bold text-white">Buscar</button>
        </form>
        {empresas.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhuma empresa encontrada.</p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {empresas.map((e) => {
              const idade = idadeEmpresa(e.dataInicio, undefined, e.anoFundacao);
              return (
                <Link key={e.id} href={`/empresa/${e.slug}`} className="rounded-2xl border border-[var(--border)] p-4 hover:border-accent">
                  <div className={`font-serif text-lg font-semibold ${empresaAtiva(e) ? '' : 'text-[var(--text-faint)]'}`}>{nomeEmpresa(e)}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {[situacaoPublica(e), idade ? `${idade.texto} de mercado` : null, e.municipio ? `${e.municipio}/${e.uf}` : null].filter(Boolean).join(' · ')}
                  </div>
                  <div className="mt-2 text-sm font-bold text-accent">{e.totalEmpreendimentos ?? 0} empreendimento(s)</div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

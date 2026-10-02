import type { Metadata } from 'next';
import ImoveisDaRegiao from '@/components/news/ImoveisDaRegiao';
import { imoveisEmDestaque } from '@/lib/news/imoveis';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TopoNews } from '@/components/news/Pecas';
import GraficoIncorporadoras from '@/components/news/GraficoIncorporadoras';
import EntrarParaVer from '@/components/news/EntrarParaVer';
import { lancamentosPorIncorporadora } from '@/lib/news/mercado';
import { getCliente } from '@/lib/cliente-auth';
import { staffAtual } from '@/lib/staff-auth';
import { SITE_URL } from '@/lib/seo';
import { regiaoDoVisitante } from '@/lib/news/regiao-visitante';
import { UFS } from '@/lib/news/base';
import JsonLd from '@/components/JsonLd';

// Ranking das incorporadoras. Depois do login: o gráfico do PAÍS e o do ESTADO do visitante.
// Sem login: prévia das 10 maiores do país e o convite para entrar.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: 'Maiores Incorporadoras do Brasil em Lançamentos e Obras' },
  description: 'Quais incorporadoras mais estão construindo no Brasil e no seu estado: empreendimentos em breve lançamento, lançamento e obras.',
  alternates: { canonical: `${SITE_URL}/news/incorporadoras` }
};

export default async function RankingIncorporadoras() {
  const reg = regiaoDoVisitante();
  const destaques = await imoveisEmDestaque(4).catch(() => []);
  const [cliente, staff, pais, doEstado] = await Promise.all([
    getCliente().catch(() => null),
    staffAtual().catch(() => null),
    lancamentosPorIncorporadora(null, 500, null),
    lancamentosPorIncorporadora(null, 500, reg.uf)
  ]);
  const liberado = !!cliente || !!staff;
  const estado = doEstado.length ? { nome: UFS[reg.uf] ?? reg.uf, dados: doEstado } : null;
  const soma = (l: typeof pais) => l.reduce((s, d) => s + d.total, 0);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Incorporadoras que mais estão construindo no Brasil',
          description: 'Ranking por número de empreendimentos em breve lançamento, lançamento e obras.',
          url: `${SITE_URL}/news/incorporadoras`,
          numberOfItems: pais.length,
          itemListElement: pais.slice(0, 20).map((d, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `${d.nome}: ${d.total} empreendimentos`,
            url: d.slug ? `${SITE_URL}/empresa/${d.slug}` : undefined
          }))
        }}
      />
      <TopoNews ativo="lancamentos" />
      <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-8 md:px-8">
        <h1 className="font-serif text-[30px] font-semibold leading-tight md:text-[42px]">As incorporadoras que mais estão construindo</h1>
        <p className="mt-2 max-w-[680px] text-[16px] leading-relaxed text-[var(--text-muted)]">
          Empreendimentos em breve lançamento, lançamento e obras, no Brasil e no seu estado. Informações coletadas e tratadas em nosso banco de dados próprio.
        </p>

        {liberado ? (
          <div className="mt-8 flex flex-col gap-8">
            <div>
              <p className="mb-2 text-sm text-[var(--text-muted)]">
                Brasil: {pais.length} incorporadoras e {soma(pais)} empreendimentos.
              </p>
              <GraficoIncorporadoras dados={pais} titulo="Brasil" />
            </div>
            {estado && (
              <div>
                <p className="mb-2 text-sm text-[var(--text-muted)]">
                  {estado.nome}: {estado.dados.length} incorporadoras e {soma(estado.dados)} empreendimentos. Para ver outro estado, troque no seletor do topo.
                </p>
                <GraficoIncorporadoras dados={estado.dados} titulo={estado.nome} />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8">
            <GraficoIncorporadoras dados={pais.slice(0, 10)} titulo="As 10 maiores do Brasil" />
            <div className="relative mt-3 overflow-hidden rounded-2xl">
              <div className="pointer-events-none select-none blur-sm" aria-hidden>
                <GraficoIncorporadoras dados={pais.slice(10, 18).map((d) => ({ ...d, nome: 'Incorporadora', slug: null }))} titulo={estado ? estado.nome : 'Seu estado'} />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--bg)]/70 p-6 text-center">
                <p className="font-serif text-xl font-semibold">Veja o ranking completo do país e do seu estado</p>
                <p className="max-w-md text-sm text-[var(--text-muted)]">Entre com a sua conta Google para liberar. É grátis.</p>
                <EntrarParaVer />
              </div>
            </div>
          </div>
        )}
      </main>
      <div className="mx-auto w-full max-w-6xl px-5 pb-14 md:px-8">
        <ImoveisDaRegiao inicial={destaques} />
      </div>
      <Footer />
    </div>
  );
}

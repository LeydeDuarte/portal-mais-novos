import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import CalculadoraIndice from '@/components/news/CalculadoraIndice';
import { Banner, TopoNews } from '@/components/news/Pecas';
import { lerIndicadores, mesAno, pct, serieValida, SERIES } from '@/lib/indicadores';
import { bannersAtivos } from '@/lib/news/dados';
import { SITE_URL } from '@/lib/seo';

// Selic, IPCA, INCC e IGP-M com gráfico: dados do Banco Central, atualizados sozinhos.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: 'Selic, IPCA, INCC e IGP-M Hoje: Gráfico e Histórico' },
  description: 'Selic, IPCA, INCC-DI, INCC-M e IGP-M atualizados todo mês com dados do Banco Central, com gráfico e o que cada índice muda no seu imóvel.',
  alternates: { canonical: `${SITE_URL}/news/indicadores` }
};

const PERIODOS = [
  { id: '12', nome: '12 meses', meses: 12 },
  { id: '60', nome: '5 anos', meses: 60 },
  { id: '120', nome: '10 anos', meses: 120 }
];

function Grafico({ pontos }: { pontos: { data: string; valor: number }[] }) {
  if (pontos.length < 2) return <p className="py-16 text-center text-sm text-[var(--text-muted)]">Dados sendo carregados do Banco Central.</p>;
  const W = 900;
  const H = 300;
  const vals = pontos.map((p) => p.valor);
  const min = Math.min(0, ...vals);
  const max = Math.max(...vals);
  const y = (v: number) => H - 20 - ((v - min) / (max - min || 1)) * (H - 40);
  const x = (i: number) => (i / (pontos.length - 1)) * W;
  const pts = pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((pontos.length - 1) * f));
  const ult = pontos[pontos.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[240px] w-full md:h-[320px]" role="img" aria-label={`Gráfico de ${pontos[0].data} a ${ult.data}`} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={20 + f * (H - 40)} y2={20 + f * (H - 40)} stroke="#EEF0F3" />
        ))}
        {min < 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="#C9CED6" strokeDasharray="4 4" />}
        <polyline points={pts} fill="none" stroke="#257CFF" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <circle cx={x(pontos.length - 1)} cy={y(ult.valor)} r="6" fill="#257CFF" />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-[var(--text-muted)]">
        {marcas.map((i) => (
          <span key={i}>{mesAno(pontos[i].data)}</span>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-[var(--text-muted)]">
        Máxima no período: {pct(max)} · mínima: {pct(Math.min(...vals))}
      </figcaption>
    </figure>
  );
}

export default async function IndicadoresPage({ searchParams }: { searchParams: { serie?: string; periodo?: string } }) {
  const serieId = searchParams.serie && serieValida(searchParams.serie) ? searchParams.serie : 'incc-di';
  const periodo = PERIODOS.find((p) => p.id === searchParams.periodo) ?? PERIODOS[0];
  const [lista, banners] = await Promise.all([lerIndicadores(120), bannersAtivos()]);
  const atual = lista.find((i) => i.id === serieId)!;
  const cfg = SERIES.find((s) => s.id === serieId)!;
  const pontos = atual.historico.slice(-periodo.meses);
  const link = (serie: string, per = periodo.id) => `/news/indicadores?serie=${serie}${per !== '12' ? `&periodo=${per}` : ''}`;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: 'Indicadores do mercado imobiliário: Selic, IPCA, INCC-DI, INCC-M e IGP-M',
          description: 'Séries mensais do Banco Central do Brasil (SGS), com fontes IBGE e FGV, atualizadas automaticamente.',
          url: `${SITE_URL}/news/indicadores`,
          creator: { '@type': 'Organization', name: 'Banco Central do Brasil' },
          isAccessibleForFree: true,
          variableMeasured: SERIES.map((s) => s.nome)
        }}
      />
      <TopoNews ativo="indicadores" />
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-5">
          <h1 className="font-serif text-[30px] font-semibold leading-tight md:text-[42px]">Selic, IPCA e INCC: os números que mexem no preço do seu imóvel</h1>
          <p className="text-[17px] leading-relaxed text-[var(--text-muted)]">
            Os índices que mexem no financiamento, nas parcelas na planta e no aluguel, com o histórico em gráfico.
          </p>
          <div className="flex flex-wrap gap-2">
            {SERIES.map((s) => (
              <Link key={s.id} href={link(s.id)} className={`flex h-10 items-center rounded-full px-4 text-sm ${s.id === serieId ? 'bg-ink font-semibold text-white' : 'border border-[var(--border)] font-medium'}`}>
                {s.nome}
              </Link>
            ))}
          </div>
          <div className="rounded-[20px] border border-[var(--border)] p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.06em] text-[var(--text-muted)]">
                  {cfg.nome.toUpperCase()} · {cfg.unidade.toUpperCase()}
                </p>
                <p className="font-sans text-[38px] font-bold tabular-nums">{pct(atual.valor)}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  {serieId === 'selic' ? `meta do Copom em ${mesAno(atual.data)}` : `${mesAno(atual.data)}${atual.acumulado12 != null ? ` · acumulado em 12 meses: ${pct(atual.acumulado12)}` : ''}`}
                </p>
              </div>
              <div className="flex gap-1.5">
                {PERIODOS.map((p) => (
                  <Link key={p.id} href={link(serieId, p.id)} className={`rounded-full px-3 py-2 text-[13px] ${p.id === periodo.id ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}>
                    {p.nome}
                  </Link>
                ))}
              </div>
            </div>
            <Grafico pontos={pontos} />
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Fonte: Banco Central do Brasil, SGS série {cfg.codigo}
              {serieId.startsWith('incc') || serieId === 'igpm' ? ' (FGV)' : serieId === 'ipca' ? ' (IBGE)' : ' (Copom)'}.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-[var(--pill-bg)] p-5">
              <h2 className="text-sm font-bold">Para que serve o {cfg.nome}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-muted)]">{cfg.explica}</p>
            </div>
            {cfg.tipo === 'mensal' ? (
              <CalculadoraIndice nome={cfg.nome} historico={atual.historico} />
            ) : (
              <div className="rounded-2xl bg-ink p-5 text-white">
                <h2 className="font-serif text-lg font-semibold">Selic não corrige valor</h2>
                <p className="mt-1.5 text-sm text-[#C5CAD3]">Ela define o custo do dinheiro. Para corrigir parcela ou aluguel, escolha IPCA, INCC ou IGP-M acima.</p>
              </div>
            )}
          </div>
        </section>
        <aside className="flex flex-col gap-3">
          <h2 className="text-[13px] font-bold tracking-[0.1em]">TODOS OS INDICADORES</h2>
          {lista.map((i) => (
            <Link key={i.id} href={link(i.id)} className={`flex items-center justify-between rounded-2xl border p-4 ${i.id === serieId ? 'border-accent' : 'border-[var(--border)]'}`}>
              <span className="flex flex-col">
                <strong className="text-[15px]">{i.nome}</strong>
                <span className="text-xs text-[var(--text-muted)]">{i.uso}</span>
              </span>
              <span className="font-sans text-lg font-bold tabular-nums">{pct(i.valor)}</span>
            </Link>
          ))}
          <Banner banners={banners} posicao="lateral" className="mt-3" />
        </aside>
      </main>
      <Footer />
    </div>
  );
}

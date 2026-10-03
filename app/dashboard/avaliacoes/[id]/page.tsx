'use client';

// Relatório de avaliação (PDF pelo "Salvar em PDF" do navegador), com a logo dos documentos.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import CabecalhoDocumento from '@/components/CabecalhoDocumento';
import { useStaffSession } from '@/lib/use-staff-session';
import { abrirAvaliacaoInterna, excluirAvaliacaoInterna, type AvaliacaoInterna } from '@/lib/actions-avaliacoes';
import { TIPOS_AVALIACAO } from '@/lib/avaliacao-calculo';
import { imprimirProposta } from '@/lib/imprimir-proposta';
import { EMPRESA } from '@/lib/seo';
import { porExtenso } from '@/lib/proposta-textos';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const dataExtenso = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const ORIGEM: Record<string, string> = { nosso: 'Mais Novos', vendido: 'Vendido (Mais Novos)', portal: 'Portal', manual: 'Informado' };

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid print:mt-3">
      <h3 className="mb-1 flex items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1B5FCC] print:text-[10px]">
        <span aria-hidden className="text-[14px] font-extrabold leading-none text-[#257CFF]">
          /
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export default function RelatorioAvaliacao() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<AvaliacaoInterna | null | undefined>(undefined);
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff && id) abrirAvaliacaoInterna(String(id)).then(setA).catch(() => setA(null));
  }, [staff, id]);
  if (!loaded || !staff) return null;
  if (a === undefined) return <PainelNav />;
  if (!a)
    return (
      <div>
        <PainelNav />
        <p className="p-8 text-sm">Avaliação não encontrada.</p>
      </div>
    );
  const i = a.imovel;
  const r = a.resultado;
  const usadas = a.amostras.filter((x) => x.usar && !x.descartada);
  const tipo = TIPOS_AVALIACAO.find(([v]) => v === i.tipo)?.[1] ?? i.tipo;
  const local = [i.condominio, i.bairro, i.cidade].filter(Boolean).join(', ');
  const portais = Array.from(new Set(usadas.map((x) => x.origem)));

  return (
    <div className="flex min-h-screen flex-col bg-[var(--pill-bg)]/40">
      <PainelNav />
      <main className="mx-auto w-full max-w-[860px] px-4 pb-20 pt-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
          <Link href="/dashboard/avaliacoes" className="text-[13px] font-semibold text-accent">
            Avaliações
          </Link>
          <div className="ml-auto flex gap-2">
            <Link href={`/dashboard/avaliacoes/nova?id=${a.id}`} className="h-10 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[13px] font-semibold">
              Editar amostras
            </Link>
            <button type="button" onClick={() => imprimirProposta(`Avaliação - ${local} - ${i.area} m2`)} className="h-10 rounded-full bg-accent px-5 text-[13px] font-semibold text-white">
              Baixar PDF
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('Excluir esta avaliação?')) return;
                await excluirAvaliacaoInterna(a.id);
                router.push('/dashboard/avaliacoes');
              }}
              className="h-10 rounded-full px-3 text-[13px] font-semibold text-red-600"
            >
              Excluir
            </button>
          </div>
        </div>

        <article className="documento-proposta mx-auto rounded-3xl border border-[var(--border)] bg-white px-10 py-9 text-[13px] leading-relaxed text-[#14161a] shadow-sm print:rounded-none print:border-0 print:text-[10.5px] print:leading-[1.38] print:shadow-none">
          <CabecalhoDocumento rotulo="Avaliação de imóvel" titulo="Relatório de avaliação" linha={`${EMPRESA.cidade}/${EMPRESA.uf}, ${dataExtenso(a.criadoEm)}`} />

          <Secao titulo="Imóvel avaliado">
            <p>
              {tipo} de <strong>{i.area} m²</strong> de área privativa
              {i.quartos ? `, ${i.quartos} quarto(s)` : ''}
              {i.suites ? ` (${i.suites} suíte(s))` : ''}
              {i.vagas != null ? `, ${i.vagas} vaga(s)` : ''}
              {i.ano ? `, entregue em ${i.ano}` : ''}
              {i.unidade ? `, unidade ${i.unidade}` : ''}. {local}.
            </p>
          </Secao>

          {r && (
            <Secao titulo="Resultado">
              <div className="rounded-2xl border-l-4 border-[#257CFF] bg-[#F2F7FF] px-5 py-3 print:py-2">
                <div className="text-[12px] text-[#5f6368]">Valor estimado de mercado</div>
                <div className="text-[24px] font-bold tabular-nums print:text-[20px]">{brl(r.valor)}</div>
                <div className="text-[12px] text-[#3c4043]">({porExtenso(r.valor)})</div>
                <div className="mt-1 text-[12.5px]">
                  Faixa de {brl(r.minimo)} a {brl(r.maximo)} · {brl(r.m2)}/m² · {r.n} amostras · grau de precisão {r.grau}
                </div>
              </div>
            </Secao>
          )}

          <Secao titulo={`Amostras utilizadas (${usadas.length})`}>
            <table className="w-full text-[11.5px] print:text-[9px]">
              <thead>
                <tr className="text-left text-[10.5px] text-[#5f6368] print:text-[8.5px]">
                  <th className="py-1 pr-2 font-semibold">Imóvel</th>
                  <th className="px-1 py-1 font-semibold">Fonte</th>
                  <th className="px-1 py-1 text-right font-semibold">m²</th>
                  <th className="px-1 py-1 text-right font-semibold">Qts/vg</th>
                  <th className="px-1 py-1 text-right font-semibold">Entrega</th>
                  <th className="px-1 py-1 text-right font-semibold">Preço</th>
                  <th className="py-1 pl-1 text-right font-semibold">R$/m² ajust.</th>
                </tr>
              </thead>
              <tbody>
                {usadas.map((x) => (
                  <tr key={x.id} className="border-t border-[#e6e8eb] align-top">
                    <td className="py-1 pr-2">
                      <strong>{x.condominio || x.titulo || 'Imóvel'}</strong>
                      {x.bairro ? `, ${x.bairro}` : ''}
                      {x.url && (
                        <span className="block break-all text-[10px] text-[#1B5FCC] print:text-[7.5px]">{x.url.startsWith('/') ? `maisnovosimoveis.com${x.url}` : x.url}</span>
                      )}
                    </td>
                    <td className="px-1 py-1">{x.origem === 'portal' && x.portal ? x.portal : ORIGEM[x.origem]}</td>
                    <td className="px-1 py-1 text-right tabular-nums">{Math.round(x.area)}</td>
                    <td className="px-1 py-1 text-right tabular-nums">
                      {x.quartos ?? '-'}/{x.vagas ?? '-'}
                    </td>
                    <td className="px-1 py-1 text-right tabular-nums">{x.ano ?? '-'}</td>
                    <td className="px-1 py-1 text-right tabular-nums">{brl(x.preco)}</td>
                    <td className="py-1 pl-1 text-right font-semibold tabular-nums">{x.m2Homog ? Math.round(x.m2Homog).toLocaleString('pt-BR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>

          <Secao titulo="Método">
            <p className="text-[11.5px] text-[#3c4043] print:text-[9px]">
              Método comparativo direto de dados de mercado (ABNT NBR 14653-2). Amostras: {portais.map((p) => ORIGEM[p].toLowerCase()).join(', ')}
              {i.horizontal ? '; condomínio horizontal: apenas casas do próprio condomínio, com idade semelhante' : i.condominio ? '; mesmo condomínio e prédios a até 1 km' : '; mesmo bairro'}; metragem até {i.margemPct ?? 20}% maior ou menor que a do imóvel avaliado. Cada amostra foi
              homogeneizada por fator de oferta (anúncios: 10% de desconto usual de negociação), área, quartos, vagas e idade; foram descartadas as amostras a mais
              de 35% da mediana; o valor é a média ponderada pela semelhança, com intervalo de confiança de 80%. É uma estimativa estatística de valor de mercado,
              baseada em preços de oferta, e não substitui laudo técnico de engenharia.
            </p>
          </Secao>

          <footer className="mt-8 flex items-center justify-between border-t border-[#e6e8eb] pt-3 text-[10.5px] text-[#9aa0a6] print:mt-4 print:text-[8.5px]">
            <span>
              {EMPRESA.razao} · CNPJ {EMPRESA.cnpj} · {EMPRESA.creci}
            </span>
            <span>maisnovosimoveis.com</span>
          </footer>
        </article>
      </main>
    </div>
  );
}

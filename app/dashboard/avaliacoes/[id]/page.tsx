'use client';

// Relatório de avaliação (PDF pelo "Salvar em PDF" do navegador), com a logo dos documentos.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import CabecalhoDocumento from '@/components/CabecalhoDocumento';
import { useStaffSession } from '@/lib/use-staff-session';
import { abrirAvaliacaoInterna, excluirAvaliacaoInterna, type AvaliacaoInterna } from '@/lib/actions-avaliacoes';
import { TIPOS_AVALIACAO, faixaMetragem, nomeFonte, resumoPorFonte } from '@/lib/avaliacao-calculo';
import { imprimirProposta } from '@/lib/imprimir-proposta';
import { EMPRESA } from '@/lib/seo';
import { porExtenso } from '@/lib/proposta-textos';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const dataExtenso = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
/** código curto do documento (do id + data), para conferência */
const codigoVerificacao = (id: string, data: string) => {
  const h = (id.replace(/-/g, '') + data.replace(/\D/g, '')).split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `MN-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}-${h.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
};

function Secao({ titulo, children, quebra = false }: { titulo: string; children: React.ReactNode; quebra?: boolean }) {
  return (
    <section className={`mt-5 print:mt-3 ${quebra ? '' : 'break-inside-avoid'}`}>
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
  const fontes = Array.from(new Set(usadas.map((x) => nomeFonte(x))));

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
              <div className="grid gap-2 sm:grid-cols-2 print:grid-cols-2">
                {r.semDesconto && (
                  <div className="rounded-2xl bg-[#F4F5F7] px-5 py-3 print:py-2">
                    <div className="text-[12px] text-[#5f6368]">Pelos preços anunciados (sem desconto)</div>
                    <div className="text-[20px] font-bold tabular-nums print:text-[17px]">{brl(r.semDesconto.valor)}</div>
                    <div className="text-[11.5px] text-[#3c4043]">
                      Faixa de {brl(r.semDesconto.minimo)} a {brl(r.semDesconto.maximo)} · {brl(r.semDesconto.m2)}/m²
                    </div>
                  </div>
                )}
                <div className="rounded-2xl border-l-4 border-[#257CFF] bg-[#F2F7FF] px-5 py-3 print:py-2">
                  <div className="text-[12px] text-[#5f6368]">Estimativa de fechamento (com {r.descontoPct ?? 10}% de desconto de negociação)</div>
                  <div className="text-[24px] font-bold tabular-nums print:text-[20px]">{brl(r.valor)}</div>
                  <div className="text-[11.5px] text-[#3c4043]">({porExtenso(r.valor)})</div>
                  <div className="text-[11.5px] text-[#3c4043]">
                    Faixa de {brl(r.minimo)} a {brl(r.maximo)} · {brl(r.m2)}/m²
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-[11.5px] text-[#3c4043] print:text-[9.5px]">
                {r.n} amostras utilizadas{r.descartadas ? `, ${r.descartadas} descartada(s) por destoar da mediana` : ''} · intervalo de confiança de 80% · amplitude de {String(r.amplitudePct).replace('.', ',')}% · grau de precisão {r.grau} (ABNT NBR 14653-2).
              </p>
            </Secao>
          )}

          {/* sem break-inside-avoid: a tabela continua na página seguinte (só a linha não se parte) */}
          <section className="mt-5 print:mt-3">
            <h3 className="mb-1 flex items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1B5FCC] print:text-[10px]">
              <span aria-hidden className="text-[14px] font-extrabold leading-none text-[#257CFF]">
                /
              </span>
              Amostras utilizadas ({usadas.length})
            </h3>
            <p className="mb-1 text-[11px] text-[#5f6368] print:text-[8.5px]">Anúncios de imóveis à venda, com o site de origem e quando cada anúncio de portal foi visto. Clique em &quot;ver anúncio&quot; para conferir (anúncios mais antigos podem já ter saído do ar).</p>
            <table className="w-full text-[11.5px] print:text-[9px]">
              <thead className="print:table-header-group">
                <tr className="text-left text-[10.5px] text-[#5f6368] print:text-[8.5px]">
                  <th className="py-1 pr-2 font-semibold">Imóvel</th>
                  <th className="px-1 py-1 font-semibold">Fonte</th>
                  <th className="px-1 py-1 text-right font-semibold">m²</th>
                  <th className="px-1 py-1 text-right font-semibold">Qts/vg</th>
                  <th className="px-1 py-1 text-right font-semibold">Entrega</th>
                  <th className="px-1 py-1 text-right font-semibold">Preço anunciado</th>
                  <th className="px-1 py-1 text-right font-semibold">Com desconto</th>
                  <th className="py-1 pl-1 text-right font-semibold">R$/m² ajust.</th>
                </tr>
              </thead>
              <tbody>
                {usadas.map((x) => {
                  const link = x.url ? (x.url.startsWith('/') ? `https://maisnovosimoveis.com${x.url}` : x.url) : null;
                  const comDesconto = x.origem === 'vendido' ? x.preco : x.preco * (1 - (r?.descontoPct ?? 10) / 100);
                  return (
                    <tr key={x.id} className="break-inside-avoid border-t border-[#e6e8eb] align-top">
                      <td className="py-1 pr-2">
                        <strong>{x.condominio || x.titulo || 'Imóvel'}</strong>
                        {x.bairro ? `, ${x.bairro}` : ''}
                      </td>
                      <td className="px-1 py-1">
                        <span className="block font-semibold">
                          {nomeFonte(x)}
                          {x.origem === 'vendido' ? ' (vendido)' : ''}
                        </span>
                        {x.tambemEm && x.tambemEm.length > 0 && <span className="block text-[9.5px] text-[#5f6368] print:text-[7.5px]">também em {x.tambemEm.join(', ')}</span>}
                        {link && (
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#1B5FCC] underline print:text-[8px]">
                            ver anúncio
                          </a>
                        )}
                        {x.vistoEm && <span className="block text-[9.5px] text-[#5f6368] print:text-[7.5px]">visto em {x.vistoEm.slice(0, 7).split('-').reverse().join('/')}</span>}
                      </td>
                      <td className="px-1 py-1 text-right tabular-nums">{Math.round(x.area)}</td>
                      <td className="px-1 py-1 text-right tabular-nums">
                        {x.quartos ?? '-'}/{x.vagas ?? '-'}
                      </td>
                      <td className="px-1 py-1 text-right tabular-nums">{x.ano ?? '-'}</td>
                      <td className="px-1 py-1 text-right tabular-nums">{brl(x.preco)}</td>
                      <td className="px-1 py-1 text-right tabular-nums">{brl(Math.round(comDesconto / 1000) * 1000)}</td>
                      <td className="py-1 pl-1 text-right font-semibold tabular-nums">{x.m2Homog ? Math.round(x.m2Homog).toLocaleString('pt-BR') : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {resumoPorFonte(a.amostras).length > 1 && (
            <Secao titulo="Comparação entre os sites">
              <table className="w-full max-w-[520px] text-[11.5px] print:text-[9px]">
                <thead className="text-left text-[10.5px] text-[#5f6368] print:text-[8.5px]">
                  <tr>
                    <th className="py-1 pr-2 font-semibold">Site</th>
                    <th className="px-1 py-1 text-right font-semibold">Amostras</th>
                    <th className="px-1 py-1 text-right font-semibold">R$/m² anunciado</th>
                    <th className="py-1 pl-1 text-right font-semibold">R$/m² ajustado</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoPorFonte(a.amostras).map((x) => (
                    <tr key={x.fonte} className="border-t border-[#e6e8eb] tabular-nums">
                      <td className="py-1 pr-2 font-semibold">{x.fonte}</td>
                      <td className="px-1 py-1 text-right">{x.n}</td>
                      <td className="px-1 py-1 text-right">{x.m2Anunciado.toLocaleString('pt-BR')}</td>
                      <td className="py-1 pl-1 text-right">{x.m2Ajustado.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Secao>
          )}

          <Secao titulo="Método">
            <p className="text-[11.5px] text-[#3c4043] print:text-[9px]">
              Método comparativo direto de dados de mercado (ABNT NBR 14653-2). Amostras de {fontes.join(', ')}
              {i.horizontal ? '; condomínio horizontal: apenas casas do próprio condomínio' : i.condominio ? `; mesmo condomínio e prédios a até ${String(i.raioKm ?? 1).replace('.', ',')} km` : '; mesmo bairro'}; metragem até {faixaMetragem(i).pct}% maior ou menor que a do imóvel avaliado
              {i.ano && (i.margemIdade ?? 5) > 0 ? `; prédios entregues até ${i.margemIdade ?? 5} anos antes ou depois de ${i.ano}` : ''}. Cada amostra foi homogeneizada por área, quartos, vagas e idade e, nos anúncios, pelo desconto de negociação estimado
              de {r?.descontoPct ?? 10}% (imóveis vendidos entram pelo valor de venda); o mesmo imóvel anunciado em mais de um site foi contado uma única vez, pela fonte mais completa; foram descartadas as amostras a mais de 35% da mediana; o valor é a média ponderada pela semelhança de cada amostra, com intervalo de confiança de 80%.
            </p>
          </Secao>

          <Secao titulo="Natureza e limitações deste relatório" quebra>
            <ol className="flex list-none flex-col gap-1 text-[10.5px] leading-snug text-[#3c4043] print:text-[8.5px]">
              <li>
                <strong>1. Natureza.</strong> Este documento é um parecer de avaliação mercadológica elaborado por corretor de imóveis (Lei nº 6.530/1978 e Resolução COFECI nº 1.066/2007), com estimativa estatística de
                valor de mercado pelo método comparativo. Não se consolida como laudo técnico, de engenharia ou judicial.
              </li>
              <li>
                <strong>2. Finalidade.</strong> Destina-se a fins comerciais e particulares: apoio à definição de preço de venda ou de compra, à negociação e à captação do imóvel, e à comprovação do preço praticado no mercado
                (preço mercadológico) na data de emissão.
              </li>
              <li>
                <strong>3. O que este relatório não é.</strong> Não se presta como laudo técnico judicial ou perícia; nem para inventário, partilha, divórcio e outros processos judiciais ou extrajudiciais que exijam laudo técnico;
                nem como avaliação para garantia de financiamento ou outros fins bancários; nem para desapropriação, seguros, fins fiscais e tributários (como ITBI, ITCMD e Imposto de Renda) quando exigido laudo técnico,
                ou fins contábeis e de reavaliação patrimonial.
              </li>
              <li>
                <strong>4. Vistoria técnica.</strong> Não substitui a avaliação de engenheiro ou arquiteto no local, que examina a estrutura física do imóvel, o estado real de conservação, as instalações e eventuais patologias
                construtivas. Não foram vistoriados o imóvel, a documentação, a regularidade, eventuais ônus ou débitos, que podem alterar o valor; foram consideradas apenas as características informadas.
              </li>
              <li>
                <strong>5. Precisão.</strong> O resultado tem intervalo de confiança de 80% e amplitude aproximada de {r ? String(r.amplitudePct).replace('.', ',') : '-'}% (grau {r?.grau ?? '-'}). Os valores são sempre
                aproximados: o preço efetivo de uma negociação pode ficar abaixo ou acima da faixa indicada.
              </li>
              <li>
                <strong>6. Amostras.</strong> As amostras são, em sua maioria, preços de oferta divulgados por terceiros em sites e portais, e não preços de venda efetivamente realizados. Os dados (preço, área, quartos, vagas,
                idade) são os informados pelos anunciantes na data indicada e não foram conferidos no local; podem conter imprecisões ou ter sido alterados ou retirados do ar depois dessa data. Um mesmo imóvel costuma
                ser anunciado em mais de um site ou por mais de um anunciante: buscamos identificar esses casos e considerar cada imóvel uma única vez, mas, como os anúncios nem sempre trazem as mesmas informações,
                algum imóvel ainda pode aparecer repetido entre as amostras.
              </li>
              <li>
                <strong>7. Datas de entrega e idade.</strong> O ano de entrega dos condomínios e das amostras, usado para considerar a idade dos imóveis, vem do nosso cadastro e de fontes públicas e pode conter
                erros. No caso de empreendimentos em lançamento ou em obras, a data é uma previsão informada pela incorporadora e pode ser alterada a qualquer tempo, o que também pode alterar o resultado.
              </li>
              <li>
                <strong>8. Desconto de negociação.</strong> O percentual de {r?.descontoPct ?? 10}% é uma estimativa adotada pelo avaliador para aproximar o preço de oferta do preço de fechamento; o desconto real varia caso a
                caso. Por isso o relatório apresenta os dois valores, com e sem desconto.
              </li>
              <li>
                <strong>9. Validade e uso.</strong> O resultado reflete as condições de mercado na data de emissão; recomenda-se atualizá-lo após 6 meses ou diante de mudança relevante. Tem caráter informativo, para apoiar a
                decisão do solicitante (Código de Defesa do Consumidor, Lei nº 8.078/1990, arts. 6º, III, e 31; Código Civil, art. 723), e não constitui garantia de preço, de venda, de prazo ou de liquidez, nem promessa de
                resultado. A empresa e a responsável técnica não respondem pelo uso deste relatório para finalidade diversa da indicada no item 2, nem por decisões tomadas exclusivamente com base nele, sem as verificações
                técnicas e documentais recomendadas.
              </li>
            </ol>
          </Secao>

          {/* assinatura eletrônica do documento */}
          <section className="mt-6 break-inside-avoid rounded-2xl border border-[#e6e8eb] px-5 py-3 print:mt-4 print:py-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="text-[11.5px] leading-snug print:text-[9px]">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1B5FCC] print:text-[8.5px]">Documento emitido eletronicamente</div>
                <strong className="text-[13px] print:text-[11px]">{a.responsavel?.nome ?? 'Mais Novos Imóveis'}</strong>
                {a.responsavel?.creci ? <span>, {a.responsavel.nome === EMPRESA.responsavelTecnica ? 'corretora de imóveis e responsável técnica' : 'corretor(a) de imóveis'}, CRECI {a.responsavel.creci.replace(/^creci\s*/i, '')}</span> : null}
                <br />
                {EMPRESA.razao} · CNPJ {EMPRESA.cnpj} · {EMPRESA.creci}
                <br />
                Emitido em {new Date(a.criadoEm).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })}
              </div>
              <div className="text-right text-[10.5px] text-[#5f6368] print:text-[8.5px]">
                Código de verificação
                <div className="font-mono text-[13px] font-bold tracking-wider text-[#14161a] print:text-[11px]">{codigoVerificacao(a.id, a.criadoEm)}</div>
              </div>
            </div>
          </section>

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

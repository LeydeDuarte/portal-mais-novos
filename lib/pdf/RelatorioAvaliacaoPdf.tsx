// Relatório de avaliação montado DIRETO em PDF (sem a impressão do navegador): sai igual no
// computador, no Android e no iPhone, com os links de verdade dentro do arquivo.
// O conteúdo acompanha a página app/dashboard/avaliacoes/[id] (mantenha os dois iguais).
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { AvaliacaoInterna } from '@/lib/actions-avaliacoes';
import { TIPOS_AVALIACAO, faixaMetragem, nomeFonte, resumoPorFonte, type AmostraAvaliacao } from '@/lib/avaliacao-calculo';
import { EMPRESA } from '@/lib/seo';
import { porExtenso } from '@/lib/proposta-textos';

/** código curto do documento (do id + data), para conferência */
export const codigoVerificacao = (id: string, data: string) => {
  const h = (id.replace(/-/g, '') + data.replace(/\D/g, '')).split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `MN-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}-${h.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
};

const AZUL = '#1B5FCC';
const AZUL2 = '#257CFF';
const CINZA = '#5f6368';
const TEXTO = '#14161a';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const dataBr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const num = (v: number) => String(v).replace('.', ',');

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 44, paddingHorizontal: 38, fontFamily: 'Inter', fontSize: 8.4, color: TEXTO, lineHeight: 1.35 },
  cab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e6e8eb', paddingBottom: 10 },
  logo: { width: 150, height: 25 },
  rotulo: { color: AZUL2, fontSize: 7.5, fontWeight: 700, letterSpacing: 1.5, textAlign: 'right' },
  titulo: { fontFamily: 'Poppins', fontSize: 15, textAlign: 'right', marginTop: 2, marginBottom: 3, lineHeight: 1.25 },
  linha: { color: CINZA, fontSize: 8, textAlign: 'right' },
  secao: { marginTop: 11 },
  h3: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  barra: { color: AZUL2, fontWeight: 700, fontSize: 11, marginRight: 4 },
  h3txt: { color: AZUL, fontWeight: 700, fontSize: 7.5, letterSpacing: 1.3 },
  caixas: { flexDirection: 'row', gap: 6 },
  caixaCinza: { flex: 1, backgroundColor: '#F4F5F7', borderRadius: 8, padding: 8 },
  caixaAzul: { flex: 1, backgroundColor: '#F2F7FF', borderRadius: 8, padding: 8, borderLeftWidth: 3, borderLeftColor: AZUL2 },
  rot: { color: CINZA, fontSize: 7.5 },
  valor: { fontWeight: 700, fontSize: 15, marginTop: 2, marginBottom: 3, lineHeight: 1.2 },
  tr: { flexDirection: 'row', borderTopWidth: 0.6, borderTopColor: '#e6e8eb', paddingVertical: 3, fontSize: 7.6 },
  th: { flexDirection: 'row', paddingBottom: 3, color: CINZA, fontSize: 7, fontWeight: 700 },
  link: { color: AZUL, textDecoration: 'underline', fontSize: 7 },
  peq: { color: CINZA, fontSize: 6.6 },
  item: { marginBottom: 3, color: '#3c4043', fontSize: 7.6 },
  assin: { marginTop: 14, borderWidth: 1, borderColor: '#e6e8eb', borderRadius: 8, padding: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  rodape: { position: 'absolute', bottom: 18, left: 38, right: 38, flexDirection: 'row', justifyContent: 'space-between', color: '#9aa0a6', fontSize: 6.8, borderTopWidth: 0.6, borderTopColor: '#e6e8eb', paddingTop: 5 }
});

// colunas da tabela de amostras (larguras em %)
const C = { imovel: '23%', fonte: '19%', m2: '6%', lote: '6%', qv: '7%', ent: '7%', preco: '13%', desc: '13%', aj: '10%' };

function Secao({ titulo, children, quebra = false }: { titulo: string; children: React.ReactNode; quebra?: boolean }) {
  return (
    <View style={s.secao} wrap={quebra}>
      <View style={s.h3} minPresenceAhead={40}>
        <Text style={s.barra}>/</Text>
        <Text style={s.h3txt}>{titulo.toUpperCase()}</Text>
      </View>
      {children}
    </View>
  );
}

/** "vendido em dd/mm/aaaa" (verde) ou "excluído em dd/mm/aaaa" (cinza), discreto, embaixo da fonte */
function Situacao({ a }: { a: AmostraAvaliacao }) {
  if (a.situacao !== 'vendido' && a.situacao !== 'excluido') return null;
  const v = a.situacao === 'vendido';
  return (
    <Text style={{ fontSize: 6.6, color: v ? '#13874B' : CINZA, fontWeight: v ? 700 : 400 }}>
      {v ? 'vendido' : 'excluído'}
      {a.situacaoEm ? ` em ${dataBr(a.situacaoEm)}` : ''}
    </Text>
  );
}

export function RelatorioAvaliacaoPdf({ a, origem }: { a: AvaliacaoInterna; origem: string }) {
  const i = a.imovel;
  const r = a.resultado;
  const usadas = a.amostras.filter((x) => x.usar && !x.descartada);
  const tipo = TIPOS_AVALIACAO.find(([v]) => v === i.tipo)?.[1] ?? i.tipo;
  const local = [i.condominio, i.bairro, i.cidade].filter(Boolean).join(', ');
  const fontes = Array.from(new Set(usadas.map((x) => nomeFonte(x))));
  const casaLote = i.horizontal && i.objeto !== 'lote';
  const desc = r?.descontoPct ?? 10;
  const resumo = resumoPorFonte(a.amostras);
  const emitido = new Date(a.criadoEm).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
  const linkDe = (x: AmostraAvaliacao) => (x.url ? (x.url.startsWith('/') ? `https://maisnovosimoveis.com${x.url}` : x.url) : null);

  const itens: [string, string][] = [
    ['1. Natureza.', 'Este documento é um parecer de avaliação mercadológica elaborado por corretor de imóveis (Lei nº 6.530/1978 e Resolução COFECI nº 1.066/2007), com estimativa estatística de valor de mercado pelo método comparativo. Não se consolida como laudo técnico, de engenharia ou judicial.'],
    ['2. Finalidade.', 'Destina-se a fins comerciais e particulares: apoio à definição de preço de venda ou de compra, à negociação e à captação do imóvel, e à comprovação do preço praticado no mercado (preço mercadológico) na data de emissão.'],
    ['3. O que este relatório não é.', 'Não se presta como laudo técnico judicial ou perícia; nem para inventário, partilha, divórcio e outros processos judiciais ou extrajudiciais que exijam laudo técnico; nem como avaliação para garantia de financiamento ou outros fins bancários; nem para desapropriação, seguros, fins fiscais e tributários (como ITBI, ITCMD e Imposto de Renda) quando exigido laudo técnico, ou fins contábeis e de reavaliação patrimonial.'],
    ['4. Vistoria técnica.', 'Não substitui a avaliação de engenheiro ou arquiteto no local, que examina a estrutura física do imóvel, o estado real de conservação, as instalações e eventuais patologias construtivas. Não foram vistoriados o imóvel, a documentação, a regularidade, eventuais ônus ou débitos, que podem alterar o valor; foram consideradas apenas as características informadas.'],
    ['5. Precisão.', `O resultado tem intervalo de confiança de 80% e amplitude aproximada de ${r ? num(r.amplitudePct) : '-'}% (grau ${r?.grau ?? '-'}). Os valores são sempre aproximados: o preço efetivo de uma negociação pode ficar abaixo ou acima da faixa indicada.`],
    ['6. Amostras.', 'As amostras são, em sua maioria, preços de oferta divulgados por terceiros em sites e portais, e não preços de venda efetivamente realizados. Os dados (preço, área, quartos, vagas, idade) são os informados pelos anunciantes na data indicada e não foram conferidos no local; podem conter imprecisões ou ter sido alterados ou retirados do ar depois dessa data. Um mesmo imóvel costuma ser anunciado em mais de um site ou por mais de um anunciante: buscamos identificar esses casos e considerar cada imóvel uma única vez, mas, como os anúncios nem sempre trazem as mesmas informações, algum imóvel ainda pode aparecer repetido entre as amostras.'],
    ['7. Datas de entrega e idade.', 'O ano de entrega dos condomínios e das amostras, usado para considerar a idade dos imóveis, vem do nosso cadastro e de fontes públicas e pode conter erros. No caso de empreendimentos em lançamento ou em obras, a data é uma previsão informada pela incorporadora e pode ser alterada a qualquer tempo, o que também pode alterar o resultado.'],
    ['8. Desconto de negociação.', `O percentual de ${desc}% é uma estimativa adotada pelo avaliador para aproximar o preço de oferta do preço de fechamento; o desconto real varia caso a caso. Por isso o relatório apresenta os dois valores, com e sem desconto.`],
    ['9. Validade e uso.', 'O resultado reflete as condições de mercado na data de emissão; recomenda-se atualizá-lo após 6 meses ou diante de mudança relevante. Tem caráter informativo, para apoiar a decisão do solicitante (Código de Defesa do Consumidor, Lei nº 8.078/1990, arts. 6º, III, e 31; Código Civil, art. 723), e não constitui garantia de preço, de venda, de prazo ou de liquidez, nem promessa de resultado. A empresa e a responsável técnica não respondem pelo uso deste relatório para finalidade diversa da indicada no item 2, nem por decisões tomadas exclusivamente com base nele, sem as verificações técnicas e documentais recomendadas.']
  ];

  const metodo =
    `Método comparativo direto de dados de mercado (ABNT NBR 14653-2). Amostras de ${fontes.join(', ')}` +
    (i.horizontal
      ? `; condomínio horizontal: ${i.objeto === 'lote' ? 'lotes' : 'casas'} do próprio condomínio e dos condomínios vizinhos a até ${num(i.raioKm ?? 2)} km`
      : i.condominio
        ? `; mesmo condomínio e prédios a até ${num(i.raioKm ?? 1)} km`
        : '; mesmo bairro') +
    `; metragem até ${faixaMetragem(i).pct}% maior ou menor que a do imóvel avaliado` +
    (i.ano && (i.margemIdade ?? 5) > 0 ? `; imóveis entregues até ${i.margemIdade ?? 5} anos antes ou depois de ${i.ano}` : '') +
    `. Cada amostra foi homogeneizada por ${i.objeto === 'lote' ? 'área do lote' : casaLote && i.areaLote ? 'área construída, tamanho do lote, quartos, vagas e idade' : 'área, quartos, vagas e idade'} e, nos anúncios, pelo desconto de negociação estimado de ${desc}% (imóveis vendidos entram pelo valor de venda); o mesmo imóvel anunciado em mais de um site foi contado uma única vez, pela fonte mais completa; foram descartadas as amostras a mais de 35% da mediana; o valor é a média ponderada pela semelhança de cada amostra, com intervalo de confiança de 80%.`;

  return (
    <Document title={`Avaliação - ${local}`} author={EMPRESA.razao} creator="maisnovosimoveis.com">
      <Page size="A4" style={s.page}>
        <View style={s.cab}>
          <Image src={`${origem}/marca/logo-documentos.png`} style={s.logo} />
          <View>
            <Text style={s.rotulo}>AVALIAÇÃO DE IMÓVEL</Text>
            <Text style={s.titulo}>Relatório de avaliação</Text>
            <Text style={s.linha}>
              {EMPRESA.cidade}/{EMPRESA.uf}, {new Date(a.criadoEm).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <Secao titulo="Imóvel avaliado">
          <Text>
            {i.objeto === 'lote'
              ? `Lote de ${num(i.area)} m² em condomínio horizontal. ${local}.`
              : `${tipo} de ${num(i.area)} m² ${i.horizontal ? 'de área construída' : 'de área privativa'}${i.horizontal && i.areaLote ? `, em lote de ${num(i.areaLote)} m²` : ''}${i.quartos ? `, ${i.quartos} quarto(s)` : ''}${i.suites ? ` (${i.suites} suíte(s))` : ''}${i.vagas != null ? `, ${i.vagas} vaga(s)` : ''}${i.ano ? `, entregue em ${i.ano}` : ''}${i.unidade ? `, unidade ${i.unidade}` : ''}. ${local}.`}
          </Text>
        </Secao>

        {r && (
          <Secao titulo="Resultado">
            <View style={s.caixas}>
              {r.semDesconto && (
                <View style={s.caixaCinza}>
                  <Text style={s.rot}>Pelos preços anunciados (sem desconto)</Text>
                  <Text style={[s.valor, { fontSize: 13 }]}>{brl(r.semDesconto.valor)}</Text>
                  <Text style={s.peq}>
                    Faixa de {brl(r.semDesconto.minimo)} a {brl(r.semDesconto.maximo)} · {brl(r.semDesconto.m2)}/m²
                  </Text>
                </View>
              )}
              <View style={s.caixaAzul}>
                <Text style={s.rot}>Estimativa de fechamento (com {desc}% de desconto de negociação)</Text>
                <Text style={s.valor}>{brl(r.valor)}</Text>
                <Text style={s.peq}>({porExtenso(r.valor)})</Text>
                <Text style={s.peq}>
                  Faixa de {brl(r.minimo)} a {brl(r.maximo)} · {brl(r.m2)}/m²
                </Text>
              </View>
            </View>
            <Text style={[s.peq, { marginTop: 3 }]}>
              {r.n} amostras utilizadas{r.descartadas ? `, ${r.descartadas} descartada(s) por destoar da mediana` : ''} · intervalo de confiança de 80% · amplitude de {num(r.amplitudePct)}% · grau de precisão {r.grau} (ABNT NBR 14653-2).
            </Text>
          </Secao>
        )}

        <View style={s.secao}>
          <View style={s.h3} minPresenceAhead={60}>
            <Text style={s.barra}>/</Text>
            <Text style={s.h3txt}>AMOSTRAS UTILIZADAS ({usadas.length})</Text>
          </View>
          <Text style={[s.peq, { marginBottom: 4 }]}>
            Os dados de cada amostra são os do anúncio na data indicada. Anúncios podem ser alterados ou retirados do ar pelos anunciantes depois dessa data; nesse caso, o link deixa de abrir, mas o registro do dado permanece válido para esta
            avaliação. Quando conhecido, a indicação "vendido em" ou "excluído em", embaixo da fonte, mostra que o imóvel foi vendido ou o anúncio saiu do ar, e a data.
          </Text>
          <View style={s.th} fixed>
            <Text style={{ width: casaLote ? '17%' : C.imovel }}>Imóvel</Text>
            <Text style={{ width: C.fonte }}>Fonte</Text>
            <Text style={{ width: C.m2, textAlign: 'right' }}>m²</Text>
            {casaLote ? <Text style={{ width: C.lote, textAlign: 'right' }}>Lote</Text> : null}
            <Text style={{ width: C.qv, textAlign: 'right' }}>Qts/vg</Text>
            <Text style={{ width: C.ent, textAlign: 'right' }}>Entrega</Text>
            <Text style={{ width: C.preco, textAlign: 'right' }}>Anunciado</Text>
            <Text style={{ width: C.desc, textAlign: 'right' }}>C/ desconto</Text>
            <Text style={{ width: C.aj, textAlign: 'right' }}>R$/m² aj.</Text>
          </View>
          {usadas.map((x) => {
            const link = linkDe(x);
            const comDesconto = x.origem === 'vendido' ? x.preco : x.preco * (1 - desc / 100);
            return (
              <View key={x.id} style={s.tr} wrap={false}>
                <View style={{ width: casaLote ? '17%' : C.imovel, paddingRight: 4 }}>
                  <Text>
                    <Text style={{ fontWeight: 700 }}>{x.condominio || x.titulo || 'Imóvel'}</Text>
                    {x.bairro ? `, ${x.bairro}` : ''}
                  </Text>
                </View>
                <View style={{ width: C.fonte, paddingRight: 4 }}>
                  <Text style={{ fontWeight: 700 }}>{nomeFonte(x)}</Text>
                  {x.tambemEm && x.tambemEm.length > 0 ? <Text style={s.peq}>também em {x.tambemEm.join(', ')}</Text> : null}
                  {link ? (
                    <Link src={link} style={s.link}>
                      ver anúncio
                    </Link>
                  ) : null}
                  {x.vistoEm ? <Text style={s.peq}>anúncio ativo em {dataBr(x.vistoEm)}</Text> : null}
                  <Situacao a={x} />
                </View>
                <Text style={{ width: C.m2, textAlign: 'right' }}>{Math.round(x.area)}</Text>
                {casaLote ? <Text style={{ width: C.lote, textAlign: 'right' }}>{x.areaLote ? Math.round(x.areaLote) : '-'}</Text> : null}
                <Text style={{ width: C.qv, textAlign: 'right' }}>
                  {x.quartos ?? '-'}/{x.vagas ?? '-'}
                </Text>
                <Text style={{ width: C.ent, textAlign: 'right' }}>{x.ano ?? '-'}</Text>
                <Text style={{ width: C.preco, textAlign: 'right' }}>{brl(x.preco)}</Text>
                <Text style={{ width: C.desc, textAlign: 'right' }}>{brl(Math.round(comDesconto / 1000) * 1000)}</Text>
                <Text style={{ width: C.aj, textAlign: 'right', fontWeight: 700 }}>{x.m2Homog ? Math.round(x.m2Homog).toLocaleString('pt-BR') : '-'}</Text>
              </View>
            );
          })}
        </View>

        {resumo.length > 1 && (
          <Secao titulo="Comparação entre os sites">
            <View style={[s.th, { width: '70%' }]}>
              <Text style={{ width: '40%' }}>Site</Text>
              <Text style={{ width: '20%', textAlign: 'right' }}>Amostras</Text>
              <Text style={{ width: '20%', textAlign: 'right' }}>R$/m² anunciado</Text>
              <Text style={{ width: '20%', textAlign: 'right' }}>R$/m² ajustado</Text>
            </View>
            {resumo.map((x) => (
              <View key={x.fonte} style={[s.tr, { width: '70%' }]}>
                <Text style={{ width: '40%', fontWeight: 700 }}>{x.fonte}</Text>
                <Text style={{ width: '20%', textAlign: 'right' }}>{x.n}</Text>
                <Text style={{ width: '20%', textAlign: 'right' }}>{x.m2Anunciado.toLocaleString('pt-BR')}</Text>
                <Text style={{ width: '20%', textAlign: 'right' }}>{x.m2Ajustado.toLocaleString('pt-BR')}</Text>
              </View>
            ))}
          </Secao>
        )}

        <Secao titulo="Método">
          <Text style={{ color: '#3c4043' }}>{metodo}</Text>
        </Secao>

        <Secao titulo="Natureza e limitações deste relatório" quebra>
          {itens.map(([t, txt]) => (
            <Text key={t} style={s.item}>
              <Text style={{ fontWeight: 700 }}>{t}</Text> {txt}
            </Text>
          ))}
        </Secao>

        <View style={s.assin} wrap={false}>
          <View>
            <Text style={[s.h3txt, { fontSize: 6.8 }]}>DOCUMENTO EMITIDO ELETRONICAMENTE</Text>
            <Text style={{ marginTop: 2 }}>
              <Text style={{ fontWeight: 700, fontSize: 10 }}>{a.responsavel?.nome ?? 'Mais Novos Imóveis'}</Text>
              {a.responsavel?.creci
                ? `, ${a.responsavel.nome === EMPRESA.responsavelTecnica ? 'corretora de imóveis e responsável técnica' : 'corretor(a) de imóveis'}, CRECI ${a.responsavel.creci.replace(/^creci\s*/i, '')}`
                : ''}
            </Text>
            <Text style={s.peq}>
              {EMPRESA.razao} · CNPJ {EMPRESA.cnpj} · {EMPRESA.creci}
            </Text>
            <Text style={s.peq}>Emitido em {emitido}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.peq}>Código de verificação</Text>
            <Text style={{ fontWeight: 700, fontSize: 10, letterSpacing: 1 }}>{codigoVerificacao(a.id, a.criadoEm)}</Text>
          </View>
        </View>

        <View style={s.rodape} fixed>
          <Text>
            {EMPRESA.razao} · CNPJ {EMPRESA.cnpj} · {EMPRESA.creci}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `maisnovosimoveis.com · página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

let fontesProntas = false;
/** Gera o arquivo PDF (no navegador) e devolve o conteúdo para baixar. */
export async function gerarPdfAvaliacao(a: AvaliacaoInterna): Promise<Blob> {
  const origem = window.location.origin;
  if (!fontesProntas) {
    Font.register({ family: 'Poppins', src: `${origem}/fontes/Poppins-SemiBold.ttf` });
    Font.register({
      family: 'Inter',
      fonts: [
        { src: `${origem}/fontes/Inter-400.ttf`, fontWeight: 400 },
        { src: `${origem}/fontes/Inter-700.ttf`, fontWeight: 700 }
      ]
    });
    Font.registerHyphenationCallback((w) => [w]); // não quebrar palavras com hífen
    fontesProntas = true;
  }
  return pdf(<RelatorioAvaliacaoPdf a={a} origem={origem} />).toBlob();
}

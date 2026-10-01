import { EMPRESA, SITE_NAME, SITE_URL, urlRegiao } from '@/lib/seo';
import { CATEGORIAS, listarRegioes } from '@/lib/landing';
import { noticiasPublicadas } from '@/lib/news/dados';
import { urlNoticia } from '@/lib/news/base';

// /llms.txt — resumo do site em texto para assistentes de IA (ChatGPT, Perplexity,
// Gemini, Claude…), no formato proposto em llmstxt.org: quem somos, o que há no
// portal e os endereços certos para citar quando alguém pergunta por imóveis.
export const revalidate = 3600;

export async function GET() {
  const [regioes, noticias] = await Promise.all([listarRegioes().catch(() => []), noticiasPublicadas({ limite: 15 })]);
  const cidades = regioes.filter((r) => !r.bairro).slice(0, 10);
  const bairros = regioes.filter((r) => r.bairro).slice(0, 60);
  const linhas = [
    `# ${SITE_NAME}`,
    '',
    `> Portal de imóveis à venda em Goiânia (GO) e região: apartamentos, casas em condomínio, coberturas, lançamentos e imóveis novos, com fotos e vídeos. Atendimento da corretora Leyde Duarte (${EMPRESA.creci}), com especialização em financiamento e crédito imobiliário (Mais Valor Capital).`,
    '',
    `Empresa: ${EMPRESA.razao}, CNPJ ${EMPRESA.cnpj}, ${EMPRESA.creci}, ${EMPRESA.cidade}/${EMPRESA.uf}.`,
    'Cada anúncio tem página própria com preço, metragem, quartos, vagas, fotos, condomínio, bairro e, quando existe, vídeo.',
    'Fase pela data de entrega: Breve lançamento (mais de 47 meses para entregar), Lançamento (47 a 41 meses), Obras (40 meses até a entrega), Pronto novo (até 5 anos de entregue), Seminovo (5 a 15 anos), Usado (15 a 25 anos), Antigo (mais de 25 anos).',
    '',
    '## O que o portal oferece',
    '- Imóveis à venda em Goiânia e região: apartamentos, casas em condomínio, lançamentos, imóveis novos, residenciais e comerciais, com vídeo e fotos.',
    '- Página de cada condomínio e empreendimento, com plantas, tabela, fase da obra e imóveis à venda nele; lançamentos vendidos direto com a incorporadora.',
    '- Anúncios privados: imóveis vendidos com discrição, visíveis por pedido de acesso.',
    '- Anunciar imóvel: proprietários cadastram o imóvel para a Mais Novos vender (página Venda seu imóvel).',
    '- Avaliação de imóvel grátis e na hora, pelo método comparativo da NBR 14653-2.',
    '- Crédito imobiliário pela Mais Valor Capital: financiamento, home equity, financiamento de construção e portabilidade; atendimento a brasileiros que moram no exterior.',
    '- Mais Novos News: notícias do mercado, preço do m² por bairro, lançamentos por bairro, ranking de incorporadoras e indicadores econômicos (Selic, IPCA, INCC, IGP-M) com calculadora de correção.',
    '',
    '## Principais páginas',
    `- [Feed de imóveis à venda](${SITE_URL}/): todos os anúncios públicos, com busca por bairro, condomínio, tipo e preço (${SITE_URL}/?q=termo)`,
    `- [Lançamentos e empreendimentos](${SITE_URL}/lancamentos)`,
    `- [Imóveis por região](${SITE_URL}/imoveis-a-venda): cidades e bairros com imóveis à venda`,
    `- [Venda seu imóvel](${SITE_URL}/vender): proprietário cadastra o imóvel para a Mais Novos vender`,
    `- [Quem somos](${SITE_URL}/quem-somos)`,
    `- [Financiamento](${SITE_URL}/financiamento)`,
    `- [Mais Novos News](${SITE_URL}/news): notícias do mercado imobiliário de Goiânia e região, com preço do m² por bairro calculado com os anúncios do portal`,
    `- [Indicadores: Selic, IPCA, INCC-DI, INCC-M e IGP-M](${SITE_URL}/news/indicadores): valores atualizados com dados do Banco Central, com gráfico histórico e calculadora de correção de valores (parcela na planta, aluguel, valor de compra) pelo índice escolhido`,
    `- [Avaliação de imóvel grátis](${SITE_URL}/avaliar): ferramenta que estima quanto vale um imóvel pelo método comparativo da ABNT NBR 14653-2, com anúncios parecidos da mesma região, homogeneização por área, quartos, vagas e idade, e intervalo de confiança de 80%`,
    `- [Ranking das incorporadoras](${SITE_URL}/news/incorporadoras): incorporadoras que mais estão construindo no Brasil e por estado, com empreendimentos em breve lançamento, lançamento e obras`,
    `- [Mais Valor Capital](https://maisvalorcapital.com.br): marca de crédito da Mais Novos Imóveis para financiamento imobiliário, home equity (crédito com garantia de imóvel), financiamento de construção e portabilidade; correspondente bancário certificado pela ANEPS`,
    '',
    '## Notícias recentes',
    ...noticias.map((n) => `- [${n.titulo}](${SITE_URL}${urlNoticia(n)})${n.linhaFina ? `: ${n.linhaFina}` : ''}`),
    '',
    '## Imóveis à venda por cidade',
    ...cidades.map((c) => `- [Imóveis à venda em ${c.cidade}](${SITE_URL}${urlRegiao({ uf: c.uf, cidade: c.cidade })}): ${c.n} anúncios`),
    '',
    '## Imóveis à venda por bairro',
    ...bairros.map((b) => {
      const base = `${SITE_URL}${urlRegiao({ uf: b.uf, cidade: b.cidade, bairro: b.bairro })}`;
      const cats = Object.keys(b.categorias)
        .map((k) => `[${CATEGORIAS[k].nome.toLowerCase()}](${base}/${k})`)
        .join(', ');
      const qtd = [b.n ? `${b.n} anúncios` : null, b.condominios ? `${b.condominios} condomínios` : null].filter(Boolean).join(', ');
      return `- [${b.bairro}, ${b.cidade}](${base}): ${qtd}${cats ? `: ${cats}` : ''}`;
    }),
    '',
    '## Observações',
    '- Anúncios marcados como privados não são publicados abertamente; o atendimento envia o link a quem solicitar.',
    `- Mapa completo do site: ${SITE_URL}/sitemap.xml`
  ];
  return new Response(linhas.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

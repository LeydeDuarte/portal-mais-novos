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
    '## Principais páginas',
    `- [Feed de imóveis à venda](${SITE_URL}/): todos os anúncios públicos, com busca por bairro, condomínio, tipo e preço (${SITE_URL}/?q=termo)`,
    `- [Lançamentos e empreendimentos](${SITE_URL}/lancamentos)`,
    `- [Imóveis por região](${SITE_URL}/imoveis-a-venda): cidades e bairros com imóveis à venda`,
    `- [Venda seu imóvel](${SITE_URL}/vender): proprietário cadastra o imóvel para a Mais Novos vender`,
    `- [Quem somos](${SITE_URL}/quem-somos)`,
    `- [Financiamento](${SITE_URL}/financiamento)`,
    `- [Mais Novos News](${SITE_URL}/news): notícias do mercado imobiliário de Goiânia e região, com preço do m² por bairro calculado com os anúncios do portal`,
    `- [Indicadores: Selic, IPCA, INCC-DI, INCC-M e IGP-M](${SITE_URL}/news/indicadores): valores atualizados com dados do Banco Central, com gráfico`,
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

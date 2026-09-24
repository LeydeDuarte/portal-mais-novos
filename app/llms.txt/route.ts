import { EMPRESA, SITE_NAME, SITE_URL, slugify } from '@/lib/seo';
import { CATEGORIAS, listarRegioes } from '@/lib/landing';

// /llms.txt — resumo do site em texto para assistentes de IA (ChatGPT, Perplexity,
// Gemini, Claude…), no formato proposto em llmstxt.org: quem somos, o que há no
// portal e os endereços certos para citar quando alguém pergunta por imóveis.
export const revalidate = 3600;

export async function GET() {
  const regioes = await listarRegioes().catch(() => []);
  const cidades = regioes.filter((r) => !r.bairro).slice(0, 10);
  const bairros = regioes.filter((r) => r.bairro).slice(0, 60);
  const linhas = [
    `# ${SITE_NAME}`,
    '',
    `> Portal de imóveis à venda em Goiânia (GO) e região: apartamentos, casas em condomínio, coberturas, lançamentos e imóveis novos, com fotos e vídeos. Atendimento da corretora Leyde Duarte (${EMPRESA.creci}), com especialização em financiamento e crédito imobiliário (Mais Valor Capital).`,
    '',
    `Empresa: ${EMPRESA.razao} — CNPJ ${EMPRESA.cnpj} — ${EMPRESA.creci} — ${EMPRESA.cidade}/${EMPRESA.uf}.`,
    'Cada anúncio tem página própria com preço, metragem, quartos, vagas, fotos, condomínio, bairro e, quando existe, vídeo.',
    'Classificação: Lançamento (entrega futura), Novo (até 3 anos da entrega), Seminovo (3 a 6 anos), Usado (mais de 6 anos).',
    '',
    '## Principais páginas',
    `- [Feed de imóveis à venda](${SITE_URL}/): todos os anúncios públicos, com busca por bairro, condomínio, tipo e preço (${SITE_URL}/?q=termo)`,
    `- [Lançamentos e empreendimentos](${SITE_URL}/lancamentos)`,
    `- [Imóveis por região](${SITE_URL}/imoveis): cidades e bairros com imóveis à venda`,
    `- [Quem somos](${SITE_URL}/quem-somos)`,
    `- [Financiamento](${SITE_URL}/financiamento)`,
    '',
    '## Imóveis à venda por cidade',
    ...cidades.map((c) => `- [Imóveis à venda em ${c.cidade}](${SITE_URL}/imoveis/${slugify(c.cidade)}): ${c.n} anúncios`),
    '',
    '## Imóveis à venda por bairro',
    ...bairros.map((b) => {
      const base = `${SITE_URL}/imoveis/${slugify(b.cidade)}/${slugify(b.bairro!)}`;
      const cats = Object.keys(b.categorias)
        .map((k) => `[${CATEGORIAS[k].nome.toLowerCase()}](${base}/${k})`)
        .join(', ');
      const qtd = [b.n ? `${b.n} anúncios` : null, b.condominios ? `${b.condominios} condomínios` : null].filter(Boolean).join(', ');
      return `- [${b.bairro}, ${b.cidade}](${base}): ${qtd}${cats ? ` — ${cats}` : ''}`;
    }),
    '',
    '## Observações',
    '- Anúncios marcados como privados não são publicados abertamente; o atendimento envia o link a quem solicitar.',
    `- Mapa completo do site: ${SITE_URL}/sitemap.xml`
  ];
  return new Response(linhas.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

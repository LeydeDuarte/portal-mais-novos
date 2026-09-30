// Mais Novos News: tópicos, regiões e o formato do texto das notícias.
// Sem acesso ao banco (pode ir para o navegador).

export const TOPICOS = [
  { id: 'mercado', nome: 'Mercado' },
  { id: 'bairros', nome: 'Bairros' },
  { id: 'lancamentos', nome: 'Lançamentos' },
  { id: 'financiamento', nome: 'Financiamento' },
  { id: 'comprar-e-vender', nome: 'Comprar e vender' },
  { id: 'investimento', nome: 'Investimento' },
  { id: 'curiosidades', nome: 'Curiosidades' },
  { id: 'direito-imobiliario', nome: 'Direito imobiliário' }
] as const;
export type TopicoId = (typeof TOPICOS)[number]['id'];
export const nomeTopico = (id: string) => TOPICOS.find((t) => t.id === id)?.nome ?? 'Mercado';
export const topicoValido = (id: string): id is TopicoId => TOPICOS.some((t) => t.id === id);

export const UFS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
};

export const slugNews = (s: string) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

export type Noticia = {
  id: string;
  slug: string;
  titulo: string;
  linhaFina: string | null;
  corpo: string;
  resumo: string[];
  faq: { p: string; r: string }[];
  capa: string | null;
  capaAlt: string | null;
  capa16x9: string | null;
  videoUrl: string | null;
  topico: string;
  tags: string[];
  uf: string | null;
  cidade: string | null;
  bairro: string | null;
  empreendimentoId: string | null;
  autor: string;
  status: 'rascunho' | 'agendada' | 'publicada';
  principal: boolean;
  seoTitulo: string | null;
  seoDescricao: string | null;
  fontes: { nome: string; url?: string }[];
  origem: string;
  leituras: number;
  focoImoveis: FocoImoveis;
  publicadoEm: string | null;
  agendadoPara: string | null;
  atualizadoEm: string;
};

export const urlNoticia = (n: Pick<Noticia, 'topico' | 'slug'>) => `/news/${n.topico}/${n.slug}`;
export const urlRegiao = (uf: string, cidade?: string | null) => `/news/regiao/${uf.toLowerCase()}${cidade ? `/${slugNews(cidade)}` : ''}`;

/** Tempo de leitura (200 palavras por minuto, mínimo 2) */
export const minutosLeitura = (texto: string) => Math.max(2, Math.round((texto.match(/\S+/g)?.length ?? 0) / 200));

// ---------------- formato do texto ----------------
// Markdown simples + blocos especiais em linha própria:
//   ## Subtítulo      ### Subtítulo menor      > citação      - item de lista
//   ![legenda](https://imagem)      **negrito**   *itálico*   [texto](https://link)
//   [[imoveis bairro="Setor Bueno" cidade="Goiânia" qtd="3" tipo="vertical"]]   imóveis do bairro (tipo opcional)
//   [[dados bairro="Setor Bueno" cidade="Goiânia"]]             números do nosso banco
//   [[video url="https://youtu.be/..."]]                         vídeo no meio do texto
//   [[banner]]                                                   espaço de publicidade
//   [[leia slug="outra-noticia"]]                                chamada para outra notícia
export type Bloco =
  | { t: 'p'; texto: string }
  | { t: 'h2' | 'h3'; texto: string; id: string }
  | { t: 'citacao'; texto: string }
  | { t: 'lista'; itens: string[] }
  | { t: 'imagem'; url: string; legenda: string }
  | { t: 'imoveis'; bairro?: string; cidade?: string; qtd: number; tipo?: 'horizontal' | 'vertical' | 'comercial' }
  | { t: 'dados'; bairro?: string; cidade?: string }
  | { t: 'video'; url: string }
  | { t: 'banner' }
  | { t: 'leia'; slug: string };

const atributos = (s: string) => Object.fromEntries(Array.from(s.matchAll(/(\w+)="([^"]*)"/g)).map((m) => [m[1], m[2]]));

export function blocosDoTexto(corpo: string): Bloco[] {
  const linhas = (corpo ?? '').replace(/\r/g, '').split('\n');
  const out: Bloco[] = [];
  let par: string[] = [];
  let lista: string[] = [];
  const fechar = () => {
    if (par.length) out.push({ t: 'p', texto: par.join(' ').trim() });
    if (lista.length) out.push({ t: 'lista', itens: lista });
    par = [];
    lista = [];
  };
  for (const bruta of linhas) {
    const l = bruta.trim();
    if (!l) {
      fechar();
      continue;
    }
    const esp = l.match(/^\[\[(\w+)\s*(.*?)\]\]$/);
    if (esp) {
      fechar();
      const a = atributos(esp[2]);
      if (esp[1] === 'imoveis')
        out.push({
          t: 'imoveis',
          bairro: a.bairro,
          cidade: a.cidade,
          qtd: Math.min(6, Math.max(1, Number(a.qtd) || 3)),
          tipo: ['horizontal', 'vertical', 'comercial'].includes(a.tipo) ? (a.tipo as 'horizontal' | 'vertical' | 'comercial') : undefined
        });
      else if (esp[1] === 'dados') out.push({ t: 'dados', bairro: a.bairro, cidade: a.cidade });
      else if (esp[1] === 'video' && a.url) out.push({ t: 'video', url: a.url });
      else if (esp[1] === 'banner') out.push({ t: 'banner' });
      else if (esp[1] === 'leia' && a.slug) out.push({ t: 'leia', slug: a.slug });
      continue;
    }
    const h = l.match(/^(#{2,3})\s+(.+)$/);
    if (h) {
      fechar();
      out.push({ t: h[1].length === 2 ? 'h2' : 'h3', texto: h[2].trim(), id: slugNews(h[2]) });
      continue;
    }
    const img = l.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/);
    if (img) {
      fechar();
      out.push({ t: 'imagem', url: img[2], legenda: img[1] });
      continue;
    }
    if (l.startsWith('>')) {
      fechar();
      out.push({ t: 'citacao', texto: l.replace(/^>\s*/, '') });
      continue;
    }
    if (/^[-*]\s+/.test(l)) {
      if (par.length) {
        out.push({ t: 'p', texto: par.join(' ').trim() });
        par = [];
      }
      lista.push(l.replace(/^[-*]\s+/, ''));
      continue;
    }
    if (lista.length) {
      out.push({ t: 'lista', itens: lista });
      lista = [];
    }
    par.push(l);
  }
  fechar();
  return out;
}

/** Texto corrido (sem marcações), para descrição, contagem de palavras e busca */
export const textoPuro = (corpo: string) =>
  blocosDoTexto(corpo)
    .map((b) => ('texto' in b ? b.texto : 'itens' in b ? b.itens.join(' ') : ''))
    .join(' ')
    .replace(/\*\*|\*|\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** Frases e palavras que denunciam texto de IA (o painel avisa antes de publicar) */
export const CLICHES = [
  'cenário em constante evolução', 'em constante evolução', 'no cenário atual', 'no mundo atual', 'nos dias de hoje', 'é importante ressaltar',
  'vale ressaltar', 'vale destacar', 'cabe destacar', 'mergulhar', 'mergulhe', 'desvendar', 'desvende', 'navegar pelo', 'jornada',
  'em suma', 'em resumo,', 'por fim, mas não menos importante', 'não é apenas', 'mais do que nunca', 'sem sombra de dúvidas',
  'um verdadeiro', 'crucial', 'fundamental para', 'potencializar', 'alavancar', 'robusto', 'no universo', 'desbloquear', 'transformador'
];
export function clichesNoTexto(texto: string): string[] {
  const t = (texto ?? '').toLowerCase();
  return CLICHES.filter((c) => t.includes(c));
}

/** Vídeo do YouTube ou Vimeo → endereço para tocar embutido, mudo e em repetição */
export function videoEmbed(url?: string | null): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&playsinline=1&rel=0&modestbranding=1`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&muted=1&loop=1&background=1`;
  return null;
}
export const miniaturaVideo = (url?: string | null) => {
  const yt = url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : null;
};

// ---------------- que imóveis combinam com a notícia ----------------
// horizontal = casas, sobrados e lotes em condomínio; vertical = apartamentos e prédios;
// comercial = salas, lojas e galpões. "auto" descobre pelo assunto do texto.
export type FocoImoveis = 'auto' | 'geral' | 'horizontal' | 'vertical' | 'comercial';
export const FOCOS: { v: FocoImoveis; l: string }[] = [
  { v: 'auto', l: 'Automático (pelo assunto)' },
  { v: 'geral', l: 'Assunto geral (vários tipos)' },
  { v: 'horizontal', l: 'Casas e condomínios horizontais' },
  { v: 'vertical', l: 'Apartamentos e prédios' },
  { v: 'comercial', l: 'Salas e imóveis comerciais' }
];
const PISTAS: Record<Exclude<FocoImoveis, 'auto' | 'geral'>, RegExp[]> = {
  horizontal: [/condom[ií]nios? (fechados?|horizonta(l|is))/g, /casas? em condom[ií]nio/g, /\bcasas?\b/g, /\bsobrados?\b/g, /\blotes?\b/g, /loteamento/g, /\bjardins\b/g, /alphaville/g, /aldeia do vale/g, /quintal/g],
  vertical: [/apartamentos?/g, /\bpr[eé]dios?\b/g, /verticai?s?/g, /verticaliza/g, /\btorres?\b/g, /coberturas?/g, /\bstudios?\b/g, /\bflats?\b/g, /andar(es)?\b/g, /rooftop/g],
  comercial: [/salas? comercia/g, /\bescrit[oó]rios?\b/g, /\blojas?\b/g, /galp[aã]o|galp[oõ]es/g, /coworking/g, /corporativ/g]
};
/** Foco da notícia: o escolhido no painel ou, no automático, o tipo mais citado no texto (null = assunto geral) */
export function focoDaNoticia(n: Pick<Noticia, 'focoImoveis' | 'titulo' | 'linhaFina' | 'tags' | 'corpo'>): Exclude<FocoImoveis, 'auto' | 'geral'> | null {
  if (n.focoImoveis === 'geral') return null;
  if (n.focoImoveis && n.focoImoveis !== 'auto') return n.focoImoveis;
  const texto = [n.titulo, n.titulo, n.linhaFina ?? '', n.tags.join(' '), n.corpo.slice(0, 4000)].join(' ').toLowerCase();
  const pontos = (Object.keys(PISTAS) as (keyof typeof PISTAS)[]).map((k) => ({ k, p: PISTAS[k].reduce((a, re) => a + (texto.match(re)?.length ?? 0), 0) }));
  pontos.sort((a, b) => b.p - a.p);
  // precisa de uma vantagem clara, senão é assunto geral (mistura de tudo)
  return pontos[0].p >= 3 && pontos[0].p >= pontos[1].p * 1.5 ? pontos[0].k : null;
}

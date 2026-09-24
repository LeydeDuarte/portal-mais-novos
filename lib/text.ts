// Padronização de textos exibidos no site — deixa tudo homogêneo, não
// importa como foi digitado no cadastro (CAIXA ALTA, tudo minúsculo...).

const MINUSCULAS = new Set([
  'a', 'à', 'ao', 'aos', 'as', 'às', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pra', 'por', 'pelo', 'pela', 'sem', 'um', 'uma'
]);
// Siglas que ficam sempre em maiúsculas
const SIGLAS = new Set(['GO', 'DF', 'SP', 'RJ', 'MG', 'BR', 'SPA', 'TV', 'CEP', 'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII', 'LTDA', 'CIA']);

function capitalizar(palavra: string): string {
  return palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1);
}

// "APARTAMENTO INCRIVEL A VENDA NO ART RESIDENCE" → "Apartamento Incrivel à Venda no Art Residence"
// Cada palavra com a primeira letra maiúscula, conectivos em minúsculas
// (de, da, no, em, e...), siglas mantidas (GO, SP...). Palavras com número
// (ex: "T-55", "3Q") ficam como foram digitadas.
export function formatTitulo(texto?: string | null): string {
  if (!texto) return '';
  const limpo = texto.replace(/\s+/g, ' ').trim();
  return limpo
    .split(' ')
    .map((original, i) => {
      if (/\d/.test(original)) return original.toLocaleUpperCase('pt-BR') === original ? original : original;
      const semPontuacao = original.replace(/[^\p{L}]/gu, '');
      if (SIGLAS.has(semPontuacao.toLocaleUpperCase('pt-BR')) && semPontuacao === semPontuacao.toLocaleUpperCase('pt-BR')) return original;
      const lower = original.toLocaleLowerCase('pt-BR');
      if (i > 0 && MINUSCULAS.has(lower.replace(/[^\p{L}]/gu, ''))) return lower;
      // capitaliza também depois de hífen/barra ("sítio/fazenda" → "Sítio/Fazenda")
      return lower
        .split(/([-/])/)
        .map((parte) => (parte === '-' || parte === '/' ? parte : capitalizar(parte)))
        .join('');
    })
    .join(' ');
}

// Texto corrido todo em CAIXA ALTA vira frase normal ("CASA AMPLA COM PISCINA" → "Casa ampla com piscina")
export function suavizarCaixaAlta(texto: string): string {
  const letras = texto.replace(/[^\p{L}]/gu, '');
  if (letras.length < 12) return texto;
  const maiusculas = letras.replace(/[^\p{Lu}]/gu, '').length;
  if (maiusculas / letras.length < 0.7) return texto;
  const lower = texto.toLocaleLowerCase('pt-BR');
  return lower.replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toLocaleUpperCase('pt-BR'));
}

// ---------------- Descrição formatada ----------------
// Formato simples, gravado como texto (bom para SEO e à prova de erro):
//   ## Subtítulo            → subtítulo no estilo do site
//   **negrito**  *itálico*  → ênfase
//   - item                  → lista
//   linha em branco         → novo parágrafo
// E automático: uma linha que começa com "Algo curto:" ganha o rótulo em
// negrito (ex: "Lazer: piscina, academia..." → "**Lazer:** piscina...").

export type Inline = { text: string; bold?: boolean; italic?: boolean };
export type Bloco = { tipo: 'titulo'; texto: Inline[] } | { tipo: 'paragrafo'; texto: Inline[] } | { tipo: 'lista'; itens: Inline[][] };

export function parseInline(texto: string): Inline[] {
  const out: Inline[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (m.index > last) out.push({ text: texto.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ text: tok.slice(2, -2), bold: true });
    else out.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }
  if (last < texto.length) out.push({ text: texto.slice(last) });
  return out;
}

function rotuloAutomatico(linha: string): string {
  // "Marcenaria e Armários: O projeto..." → "**Marcenaria e Armários:** O projeto..."
  const m = linha.match(/^([^:*#\-][^:]{1,45}):\s+(.+)$/);
  if (!m) return linha;
  const rotulo = m[1].trim();
  if (rotulo.split(/\s+/).length > 6 || /[.!?]/.test(rotulo)) return linha;
  return `**${rotulo}:** ${m[2]}`;
}

export function parseDescricao(texto?: string | null): Bloco[] {
  if (!texto) return [];
  const linhas = suavizarCaixaAlta(texto.replace(/\r\n/g, '\n')).split('\n');
  const blocos: Bloco[] = [];
  let lista: Inline[][] | null = null;
  let paragrafo: string[] = [];

  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: 'paragrafo', texto: parseInline(paragrafo.join(' ')) });
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista?.length) blocos.push({ tipo: 'lista', itens: lista });
    lista = null;
  };

  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    if (/^#{1,3}\s+/.test(linha)) {
      fecharParagrafo();
      fecharLista();
      blocos.push({ tipo: 'titulo', texto: parseInline(formatTitulo(linha.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, ''))) });
      continue;
    }
    if (/^[-•*]\s+/.test(linha)) {
      fecharParagrafo();
      lista = lista ?? [];
      lista.push(parseInline(rotuloAutomatico(linha.replace(/^[-•*]\s+/, ''))));
      continue;
    }
    fecharLista();
    // Cada linha com rótulo ("Lazer: ...") vira um parágrafo próprio
    const comRotulo = rotuloAutomatico(linha);
    if (comRotulo !== linha) {
      fecharParagrafo();
      blocos.push({ tipo: 'paragrafo', texto: parseInline(comRotulo) });
      continue;
    }
    paragrafo.push(linha);
  }
  fecharParagrafo();
  fecharLista();
  return blocos;
}

// Versão em texto puro (sem ** ## -) — para meta description, cards, SEO
export function descricaoTextoPuro(texto?: string | null): string {
  return (texto ?? '')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

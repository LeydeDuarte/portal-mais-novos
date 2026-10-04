// Leitura GENÉRICA (por regras, sem IA, grátis) das tabelas de preços em PDF das incorporadoras.
// Não depende do layout de cada empresa: usa o que todas têm em comum.
//  - linha de unidade = tem um valor em reais (o maior da linha é o VALOR TOTAL) e um número de
//    unidade no começo ("901", "1.001", "501A", "1201-A", "AP 1207", "Campo 402");
//  - área privativa = a MAIOR área da linha que dá um R$/m² plausível com o valor
//    (assim não pega a área da vaga ou do escaninho, que são sempre menores);
//  - situação: "vendido"/"reservado" quando escrito na linha; senão, disponível;
//  - títulos de seção ("ED. CULT OXFORD - LESTE UNIVERSITARIO") dão o empreendimento das linhas de
//    baixo (tabelas de revenda com vários empreendimentos).
import type { UnidadeTabela } from '@/lib/pdf-import/parse';

type Doc = { paginas: string[][] };

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const RE_DINHEIRO = /^\d{1,3}(?:\.\d{3})+(?:,\d{2})?$/; // 1.188.987,88 / 385.000
const RE_DECIMAL = /^\d{1,4}[,.]\d{1,2}$/; // 118,57 ou 241.90
const RE_UNIDADE = /^\*?(\d{1,2}\.\d{3}|\d{2,5})(-?[A-Za-z]{1,2})?\*{0,2}$/; // 901, 1.001, 501A, 1201-A
const num = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));
/** área: "118,57" ou "241.90" (ponto decimal com 2 casas) */
const numArea = (t: string) => (/^\d{1,4}\.\d{1,2}$/.test(t) ? Number(t) : num(t));
const PALAVRAS_NAO_SECAO =
  /\b(tabela|validade|financiamento|area|areas|unidade|unid|pronto|localizacao|razao|sinal|mensais|semestrais|unica|valor|previsao|entrega|parcelas|reajust|proposta|obs|atencao|informacoes|garagem|garagens|escaninho|privativa|data|pavimento|vendas|direta|incorporador|ate|habite)\b/;

/** Título de seção de uma tabela com vários empreendimentos (revenda): "ED. CULT OXFORD - LESTE UNIVERSITARIO" → "Cult Oxford". */
function tituloSecao(linha: string): string | null {
  const t = linha.trim();
  if (t.length < 4 || t.length > 90 || /\d{3}/.test(t)) return null;
  const s = semAcento(t).toLowerCase();
  if (PALAVRAS_NAO_SECAO.test(s)) return null;
  if (/^(av|avenida|rua|r|al|alameda|qd|quadra|rod|rodovia|estrada|travessa)\b\.?/.test(s)) return null; // endereço não é título
  const letras = t.replace(/[^A-Za-zÀ-ú]/g, '');
  if (letras.length < 4 || letras !== letras.toUpperCase()) return null; // só títulos em MAIÚSCULAS
  const [parte1, parte2] = t.split(/\s+-\s+/);
  const GENERICO = /^(SOBRADO|CASA|LOTE|TERRENO|APARTAMENTO|APTO|SALA|LOJA)$/i;
  const nome = (GENERICO.test(parte1.trim()) && parte2 ? `${parte1} ${parte2}` : parte1)
    .replace(/^(ED\.?|EDIF[IÍ]CIO|RESIDENCIAL|CONDOM[IÍ]NIO)\s+/i, '')
    .replace(/^(LOTE|LOTES|CASA|CASAS|SOBRADO|APTO|APARTAMENTO)\s+(?=\S+\s+\S)/i, '')
    .trim();
  if (nome.length < 3) return null;
  return nome
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (c) => c.toLowerCase());
}

/** Uma linha da tabela → unidade (ou null se não for linha de unidade). */
export function lerLinhaUnidade(linha: string): Omit<UnidadeTabela, 'empreendimento'> | null {
  const toks = linha.replace(/R\$\s*/g, ' ').split(/\s+/).filter(Boolean);
  const valores = toks.map((t, i) => ({ t, i })).filter((x) => RE_DINHEIRO.test(x.t) && num(x.t) >= 30000);
  if (!valores.length) return null;
  const valor = Math.max(...valores.map((x) => num(x.t)));
  const iValor = valores.find((x) => num(x.t) === valor)!.i;
  // área privativa: a maior área antes do valor com R$/m² plausível (lote barato até alto padrão)
  let iArea = -1;
  let primeira = -1;
  for (let i = 0; i < iValor; i++) {
    if (!RE_DECIMAL.test(toks[i])) continue;
    const a = numArea(toks[i]);
    const m2 = valor / a;
    if (a >= 15 && a <= 5000 && m2 >= 150 && m2 <= 60000) {
      if (primeira < 0) primeira = i;
      if (iArea < 0 || a > numArea(toks[iArea])) iArea = i;
    }
  }
  if (iArea < 0) {
    // sem área com vírgula (ex.: lotes "762", "1.043", ou "343 m²"): números inteiros; se a linha
    // escreve "m²", só vale o número logo antes do "m²" (assim "VAGA 210" e "0 m²" não viram área)
    const temM2 = toks.some((t) => /^m[²2]$/i.test(t));
    for (let i = 1; i < iValor; i++) {
      if (!/^(\d{2,4}|\d{1,2}\.\d{3})$/.test(toks[i])) continue;
      if (temM2 && !/^m[²2]$/i.test(toks[i + 1] ?? '')) continue;
      const a = Number(toks[i].replace('.', ''));
      const m2 = valor / a;
      if (a >= 15 && a <= 50000 && m2 >= 30 && m2 <= 60000 && (iArea < 0 || a > numArea(toks[iArea]))) iArea = i;
    }
    if (iArea < 0 || valor < 100000) return null;
    if (primeira < 0) primeira = iArea;
  }
  // vaga, escaninho e depósito vendidos à parte não são unidades
  if (/^(vaga|box|escaninho|dep[oó]sito|mt\d)/i.test(toks[0] ?? '')) return null;
  // unidade: número no começo da linha (antes da primeira área); lote/casa: "QD 10 LOTE 08"
  let unidade: string | null = null;
  let torreNome: string | null = null;
  const antesTxt = toks.slice(0, primeira).join(' ').replace(/[*]/g, '').trim();
  if (/\b(qd|quadra)\b/i.test(antesTxt) && /\b(lt|lote)\b/i.test(antesTxt)) unidade = antesTxt.toUpperCase().slice(0, 40);
  for (let i = 0; i < primeira && !unidade; i++) {
    // lote de 1 dígito ("4") só como primeiro item da linha
    const m = toks[i].match(RE_UNIDADE) ?? (i === 0 ? toks[i].match(/^(\d)()$/) : null);
    if (m && !RE_DECIMAL.test(toks[i])) {
      unidade = `${m[1].replace('.', '')}${m[2] ?? ''}`.toUpperCase();
      // "903 - Modern": a palavra depois do hífen é a torre (o mesmo número pode existir nas duas)
      if (toks[i + 1] === '-' && /^[A-Za-zÀ-ú]{3,}$/.test(toks[i + 2] ?? '')) torreNome = toks[i + 2];
      break;
    }
  }
  if (!unidade) {
    // sem número (ex.: casa na revenda): usa o texto antes da área, ou "S/N"
    if (/\d{1,3}(\.\d{3})+/.test(antesTxt)) return null;
    unidade = antesTxt ? antesTxt.slice(0, 40) : 'S/N';
  }
  const torre = torreNome ?? antesTxt.match(/\b(?:t|torre|bl|bloco)\s*([a-z0-9]{1,2})\b/i)?.[1]?.toUpperCase();
  const s = semAcento(linha).toLowerCase();
  const situacao: UnidadeTabela['situacao'] = /\bvendid/.test(s) ? 'vendida' : /\breservad/.test(s) ? 'reservada' : 'disponivel';
  const area = /^\d{1,2}\.\d{3}$/.test(toks[iArea]) ? Number(toks[iArea].replace('.', '')) : numArea(toks[iArea]);
  return { unidade, area, valor, situacao, ...(torre ? { torre } : {}) };
}

/** Todas as unidades do PDF (com o empreendimento de cada seção, quando houver títulos). */
export function lerTabelaGenerica(doc: Doc): UnidadeTabela[] {
  const out: UnidadeTabela[] = [];
  const vistas = new Set<string>();
  let secao: string | null = null;
  let quadra: string | null = null;
  for (const pag of doc.paginas) {
    let soNumero = ''; // linha só com o número da unidade ("1006 -"), o resto vem na linha de baixo
    for (const linhaOriginal of pag) {
      const q = linhaOriginal.match(/^\s*(?:quadra|qd\.?)\s+([0-9a-z]{1,4})\s*$/i);
      if (q) {
        quadra = q[1].toUpperCase();
        soNumero = '';
        continue;
      }
      if (/^\s*\*?\d{2,5}[a-z]?\s*-?\s*$/i.test(linhaOriginal)) {
        soNumero = linhaOriginal.trim().replace(/\s*-$/, '');
        continue;
      }
      // só junta quando a linha de baixo NÃO começa com outro número de unidade (começa com a área "75,89 m²" ou com texto "Connect")
      const linha = soNumero && !/^\s*\*?\d{1,5}[a-z]?(?:\s|-|$)/i.test(linhaOriginal) ? `${soNumero} ${linhaOriginal}` : linhaOriginal;
      soNumero = '';
      const lida = lerLinhaUnidade(linha);
      const u = lida && quadra && /^\d{1,3}[a-z]?$/i.test(lida.unidade) ? { ...lida, unidade: `QD ${quadra} LT ${lida.unidade}` } : lida;
      if (!u) {
        const t = tituloSecao(linhaOriginal);
        if (t) secao = t;
        continue;
      }
      const chave = `${secao ?? ''}|${u.torre ?? ''}|${u.unidade}`;
      if (vistas.has(chave)) continue; // a mesma unidade repetida (ex.: tabela com 2 condições)
      vistas.add(chave);
      out.push(secao ? { ...u, empreendimento: secao } : u);
    }
  }
  return out;
}

const MESES: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6,
  jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12
};
const ano4 = (a: string) => (a.length === 2 ? `20${a}` : a);
const ok = (a: string, m: number) => Number(a) >= 2000 && Number(a) <= 2100 && m >= 1 && m <= 12;

/** Mês de referência num trecho: "jun25", "jun-25", "set/2026", "Setembro2026", "09-2026", "2026_05", "01/06/2025". */
function mesNoTrecho(trecho: string): string | null {
  const t = semAcento(trecho).toLowerCase();
  let m = t.match(/\b\d{1,2}[/.-](\d{1,2})[/.-](\d{4})\b/); // 01/06/2025
  if (m && ok(m[2], Number(m[1]))) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = t.match(/(?:^|[^a-z])(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*[-/_ ]?\s*(?:de\s*)?(\d{4}|\d{2})(?!\d)/);
  if (m && ok(ano4(m[2]), MESES[m[1]])) return `${ano4(m[2])}-${String(MESES[m[1]]).padStart(2, '0')}`;
  m = t.match(/(?:^|[^\d])(\d{1,2})[-/_.](\d{4})(?!\d)/); // 09-2026
  if (m && ok(m[2], Number(m[1]))) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = t.match(/(?:^|[^\d])(\d{4})[-/_.](\d{1,2})(?!\d)/); // 2026_05
  if (m && ok(m[1], Number(m[2]))) return `${m[1]}-${m[2].padStart(2, '0')}`;
  return null;
}

/** Mês da tabela: primeiro pelo nome do arquivo; depois pelas linhas do texto que falam da tabela
 *  (tabela, validade, data, mês), ignorando as linhas de ENTREGA; por último, qualquer data do texto. */
export function mesDaTabela(nomeArquivo: string, texto: string): string | null {
  const doNome = mesNoTrecho(nomeArquivo.replace(/\.[a-z0-9]+$/i, ''));
  if (doNome) return doNome;
  const linhas = texto.split('\n').filter((l) => !/entrega|habite|chaves/i.test(semAcento(l)));
  for (const l of linhas) if (/tabela|validade|\bdata\b|\bmes\b/i.test(semAcento(l))) {
    const m = mesNoTrecho(l);
    if (m) return m;
  }
  for (const l of linhas) {
    const m = mesNoTrecho(l);
    if (m) return m;
  }
  return null;
}

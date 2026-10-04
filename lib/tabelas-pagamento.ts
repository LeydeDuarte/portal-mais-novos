// Fluxo de pagamento da tabela de vendas (por regras, grátis): o cabeçalho traz os nomes das
// parcelas (sinal, mensais, semestrais, única, chaves, financiamento), quantas vezes e a partir de
// quando; a primeira linha de unidade traz os valores. O fluxo só é montado em PERCENTUAIS quando a
// conta fecha (soma das parcelas = valor total da unidade, com até 3% de diferença); senão fica só
// o texto do cabeçalho, sem inventar nada.
import { lerLinhaUnidade } from './tabelas-pdf';

export type ParcelaFluxo = { nome: string; qtd: number; inicio: string | null; pct: number };
export type PagamentoTabela = {
  /** cabeçalho da tabela como veio (para a IA e para a equipe conferirem) */
  texto: string;
  /** fluxo em percentuais do valor total; null quando a conta não fechou */
  fluxo: ParcelaFluxo[] | null;
};

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const RE_DINHEIRO = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;
const num = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));

const RE_NOME =
  /(sinal|entrada|ato|mensa(?:l|is)|semestra(?:l|is)|anua(?:l|is)|bimestra(?:l|is)|trimestra(?:l|is)|intermedi[aá]rias?|[uú]nica|chaves|habite-?\s?se|financ(?:iamento|\.)?|saldo|parcelas?|p[oó]s[-\s]?chaves?|subtotal|desconto)/gi;
const NOME_BONITO: Record<string, string> = {
  sinal: 'Sinal', entrada: 'Entrada', ato: 'Ato', mensal: 'Mensais', mensais: 'Mensais', semestral: 'Semestrais', semestrais: 'Semestrais',
  anual: 'Anuais', anuais: 'Anuais', bimestral: 'Bimestrais', bimestrais: 'Bimestrais', trimestral: 'Trimestrais', trimestrais: 'Trimestrais',
  intermediaria: 'Intermediária', intermediarias: 'Intermediárias', unica: 'Única', chaves: 'Chaves', 'habite-se': 'Habite-se', habitese: 'Habite-se',
  'habite se': 'Habite-se', financ: 'Financiamento', 'financ.': 'Financiamento', financiamento: 'Financiamento', saldo: 'Saldo', parcela: 'Parcelas',
  parcelas: 'Parcelas', 'pos-chaves': 'Pós-chaves', 'pos chaves': 'Pós-chaves', poschaves: 'Pós-chaves', 'pos-chave': 'Pós-chaves', subtotal: 'Subtotal', desconto: 'Desconto'
};
const bonito = (n: string) => NOME_BONITO[semAcento(n).toLowerCase().replace(/\s+/g, ' ')] ?? n;

// datas e prazos do cabeçalho: "Ato", "30 e 60", "dez/2026", "set. de 2026", "05/12/26", "10/06/2028", "jul-25"
const RE_QUANDO =
  /\b(ato|a vista|30\s*(?:e|\/)\s*60(?:\s*(?:e|\/)\s*90)?|\d{2,3}\s*dias|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*(?:de\s*)?[-/]?\s*\d{2,4})\b/gi;

/** Lê o fluxo de pagamento de um PDF já em linhas. */
export function lerPagamento(doc: { paginas: string[][] }): PagamentoTabela | null {
  for (const pag of doc.paginas) {
    const iUn = pag.findIndex((l) => lerLinhaUnidade(l));
    if (iUn < 0) continue;
    const linhaUn = pag[iUn];
    const u = lerLinhaUnidade(linhaUn)!;
    const cab = pag
      .slice(Math.max(0, iUn - 14), iUn)
      .filter((l) => l.trim() && !/^\s*(localiza|endere|razao social)|esta tabela|reajust|proposta|garante|cheque/i.test(semAcento(l)));
    const texto = cab
      .map((l) => l.replace(/\s{2,}/g, '  ').trim())
      .join('\n')
      .slice(0, 1500);

    // valores das parcelas: os valores em reais DEPOIS do valor total (sem repetir o total e sem zeros)
    const toks = linhaUn.replace(/R\$\s*/g, ' ').split(/\s+/).filter(Boolean);
    const iValor = toks.findIndex((t) => RE_DINHEIRO.test(t) && Math.abs(num(t) - (u.valor ?? 0)) < 0.01);
    const valores = toks
      .slice(iValor + 1)
      .filter((t) => RE_DINHEIRO.test(t))
      .map(num)
      .filter((v) => v > 0 && Math.abs(v - (u.valor ?? 0)) > (u.valor ?? 0) * 0.005);
    const total = u.valor ?? 0;
    if (!valores.length || !total) return { texto, fluxo: null };

    // nomes (linha com mais nomes de parcela), quantidades (linha com mais números pequenos) e datas
    // frases descritivas ("OPÇÃO DE FINANCIAMENTO DIRETO ... ATÉ AS CHAVES") não são o cabeçalho das colunas
    const descritiva = (l: string) => /op[cç][aã]o|at[eé] as chaves|tabela (de )?vendas|pos chaves \+|meses p[oó]s/i.test(semAcento(l));
    const nomesPorLinha = cab.map((l) => (descritiva(l) ? [] : semAcento(l).match(RE_NOME) ?? []));
    const iNomes = nomesPorLinha.reduce((m, n, i) => (n.length >= nomesPorLinha[m].length && n.length ? i : m), 0);
    const qtdPorLinha = cab.map((l) =>
      (semAcento(l)
        .replace(RE_QUANDO, ' ')
        .match(/(?:^|\s|\()(\d{1,3})x?\)?(?=\s|$)/gi) ?? []
      ).map((t) => Number(t.replace(/\D/g, '')))
    );
    const iQtd = qtdPorLinha.reduce((m, q, i) => (q.length >= qtdPorLinha[m].length && q.length ? i : m), 0);
    const qtds = qtdPorLinha[iQtd] ?? [];
    const datasPorLinha = cab.map((l) => (l.match(RE_QUANDO) ?? []).map((d) => d.replace(/\s+/g, ' ').trim()));
    const iDatas = datasPorLinha.reduce((m, d, i) => (d.length >= datasPorLinha[m].length && d.length ? i : m), 0);
    const datas = datasPorLinha[iDatas] ?? [];
    // "Ato" na linha das datas é a data da 1ª parcela do sinal, não um nome de coluna
    const atoEhData = datas.some((d) => /^ato$/i.test(d));
    let nomes = (nomesPorLinha[iNomes] ?? []).filter((n) => !(atoEhData && /^ato$/i.test(n))).map(bonito);

    // tenta as quantidades do cabeçalho (com e sem o financiamento no fim, que costuma ser 1x);
    // tabela com desconto: as primeiras colunas são o desconto e o "total - desconto", e o fluxo
    // fecha sobre o total com desconto
    let confere: number[] | undefined;
    let base = total;
    let vals = valores;
    for (let ini = 0; ini <= Math.min(2, valores.length - 1) && !confere; ini++) {
      const vs = valores.slice(ini);
      const bases = ini === 0 ? [total] : [valores[ini - 1], total];
      const k0 = vs.length;
      const tentativas: number[][] = [];
      if (qtds.length >= k0) tentativas.push(qtds.slice(qtds.length - k0));
      if (qtds.length === k0 - 1) tentativas.push([...qtds, 1]);
      if (qtds.length >= k0) tentativas.push(qtds.slice(0, k0));
      tentativas.push(vs.map(() => 1));
      for (const b of bases) {
        const q = tentativas.find((t) => Math.abs(vs.reduce((s2, v, i) => s2 + v * t[i], 0) - b) <= b * 0.03);
        if (q) {
          confere = q;
          base = b;
          vals = vs;
          if (ini > 0) nomes = nomes.filter((n) => !/desconto|^total$/i.test(n));
          break;
        }
      }
    }
    if (!confere) return { texto, fluxo: null };
    const k = vals.length;

    // nomes: a última coluna grande sem nome é o financiamento/saldo; coluna que sobra é a
    // continuação do sinal (ex.: "Sinal" ocupa 2 colunas: ato + 30/60 dias)
    nomes = nomes.filter((n) => !/^subtotal$/i.test(n));
    if (nomes.length > k) nomes = nomes.slice(0, k);
    const ultimoPct = (vals[k - 1] * confere[k - 1]) / base;
    if (nomes.length < k && ultimoPct >= 0.4 && !nomes.some((n) => /financ|saldo|chaves|habite/i.test(n))) nomes.push('Financiamento');
    while (nomes.length < k) nomes.splice(1, 0, nomes[0] ? `${nomes[0]} (parcelas)` : 'Parcela');
    const inicio = (i: number) => (datas.length === k ? datas[i] : datas.length === k - 1 ? (i < k - 1 ? datas[i] : null) : null);
    const fluxo = vals.map((v, i) => ({
      nome: nomes[i] ?? 'Parcela',
      qtd: confere![i],
      inicio: inicio(i),
      pct: Math.round(((v * confere![i]) / base) * 10000) / 100
    }));
    return { texto, fluxo };
  }
  return null;
}

/** Fluxo em texto curto: "Sinal 4% (1x, Ato) · Mensais 9% (17x, dez/2026) · ..." */
export function fluxoEmTexto(f: ParcelaFluxo[]): string {
  return f.map((p) => `${p.nome} ${String(p.pct).replace('.', ',')}% (${p.qtd}x${p.inicio ? `, ${p.inicio}` : ''})`).join(' · ');
}

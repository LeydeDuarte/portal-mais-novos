export const FORMAS_PAGAMENTO: Record<string, string> = {
  a_vista: 'À vista (recursos próprios)',
  financiamento: 'Financiamento bancário',
  fgts: 'Uso do FGTS',
  consorcio: 'Carta de consórcio',
  permuta: 'Permuta (imóvel ou bem como parte do pagamento)',
  parcelamento_direto: 'Parcelamento direto com o proprietário',
  outro: 'Outra condição (descrita abaixo)'
};
export const ESTADO_CIVIL: Record<string, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  uniao_estavel: 'União estável',
  divorciado: 'Divorciado(a)',
  separado: 'Separado(a)',
  viuvo: 'Viúvo(a)'
};
export const STATUS_PROPOSTA: Record<string, string> = {
  nova: 'Nova',
  em_analise: 'Em análise',
  enviada_proprietario: 'Enviada ao proprietário',
  aceita: 'Aceita',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
  arquivada: 'Arquivada'
};
export const brl = (n: number | null | undefined) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '');

/** Valor por extenso (reais inteiros), para o documento da proposta */
export function porExtenso(valor: number): string {
  const u = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const partes: string[] = [];
    if (n >= 100) partes.push(c[Math.floor(n / 100)]);
    const r = n % 100;
    if (r >= 20) partes.push(d[Math.floor(r / 10)] + (r % 10 ? ` e ${u[r % 10]}` : ''));
    else if (r) partes.push(u[r]);
    return partes.join(' e ');
  };
  const n = Math.floor(valor);
  if (n === 0) return 'zero reais';
  const grupos = [
    { v: Math.floor(n / 1e9) % 1000, s: 'bilhão', p: 'bilhões' },
    { v: Math.floor(n / 1e6) % 1000, s: 'milhão', p: 'milhões' },
    { v: Math.floor(n / 1e3) % 1000, s: 'mil', p: 'mil' },
    { v: n % 1000, s: '', p: '' }
  ];
  const txt = grupos
    .filter((g) => g.v)
    .map((g) => (g.s === 'mil' && g.v === 1 ? 'mil' : `${ate999(g.v)}${g.s ? ` ${g.v === 1 ? g.s : g.p}` : ''}`));
  let frase = txt.join(', ').replace(/, ([^,]*)$/, (m, ult) => (n % 1000 && (n % 1000 < 100 || n % 100 === 0) ? ` e ${ult}` : `, ${ult}`));
  if (n % 1e6 === 0 && n >= 1e6) frase += ' de';
  return `${frase} ${n === 1 ? 'real' : 'reais'}`;
}

/** Número exibido da proposta: a numeração começa em 200 (a 1ª proposta é a nº 0200). */
export const PRIMEIRO_NUMERO_PROPOSTA = 200;
export const numeroProposta = (n: number | null | undefined) => (n ? String(n + PRIMEIRO_NUMERO_PROPOSTA - 1).padStart(4, '0') : '');

// ---------------- intermediação e honorários ----------------
/** Quem intermedeia: imobiliária (CNPJ) ou corretor(a) (CRECI). Só UM assina a proposta. */
export type Intermediario = {
  tipo: 'imobiliaria' | 'corretor';
  nome: string;
  documento?: string; // CNPJ da imobiliária (ou CPF do corretor, opcional)
  creci?: string;
  papel: 'responsavel' | 'parceiro';
  assina: boolean;
  /** parte nos honorários (%), opcional: só aparece no PDF se alguém tiver parte */
  partePct?: number | null;
};

/** Intermediação padrão: a Mais Novos (assina) e o corretor logado como responsável. */
export function intermediacaoPadrao(corretor?: { nome: string; creci?: string } | null): Intermediario[] {
  const lista: Intermediario[] = [{ tipo: 'imobiliaria', nome: 'Mais Novos Inteligência Imobiliária', documento: '36.006.396/0001-21', creci: 'CJ 38746', papel: 'responsavel', assina: true }];
  if (corretor?.nome) lista.push({ tipo: 'corretor', nome: corretor.nome, creci: corretor.creci, papel: 'responsavel', assina: false });
  return lista;
}

const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/** "Mais Novos ..., CNPJ x, CRECI y (responsável); Fulano, corretor parceiro, CRECI z" */
export function textoIntermediacao(lista: Intermediario[]): string {
  return lista
    .map((i) => {
      const partes = [i.nome];
      if (i.tipo === 'imobiliaria') {
        if (i.documento) partes.push(`CNPJ ${i.documento}`);
      } else partes.push(i.papel === 'parceiro' ? 'corretor(a) parceiro(a)' : 'corretor(a)');
      if (i.creci) partes.push(/^creci/i.test(i.creci) ? i.creci : `CRECI ${i.creci}`);
      const papel = i.tipo === 'imobiliaria' ? (i.papel === 'parceiro' ? ' (parceira)' : ' (responsável)') : i.papel === 'responsavel' ? ' (responsável)' : '';
      return `${partes.join(', ')}${papel}`;
    })
    .join('; ');
}

export type Honorarios = { pct: number; valor: number; liquido: number; divisao: { nome: string; pct: number; valor: number }[] };

/** Honorários a partir do percentual (arredondado ao real). Sem percentual → null (o quadro não aparece). */
export function calcularHonorarios(valorTotal: number, honorariosPct: number | null | undefined, lista: Intermediario[] = []): Honorarios | null {
  if (!honorariosPct || honorariosPct <= 0 || !valorTotal) return null;
  const valor = Math.round((valorTotal * honorariosPct) / 100);
  const divisao = lista
    .filter((i) => i.partePct && i.partePct > 0)
    .map((i) => ({ nome: i.nome, pct: i.partePct as number, valor: Math.round((valorTotal * (i.partePct as number)) / 100) }));
  return { pct: honorariosPct, valor, liquido: valorTotal - valor, divisao };
}

/** A divisão (se houver) precisa somar o percentual total. */
export function divisaoConfere(honorariosPct: number | null | undefined, lista: Intermediario[]): boolean {
  const partes = lista.filter((i) => i.partePct && i.partePct > 0);
  if (!partes.length || !honorariosPct) return true;
  const soma = partes.reduce((a, i) => a + (i.partePct as number), 0);
  return Math.abs(soma - honorariosPct) < 0.005;
}
export const textoPct = pct;

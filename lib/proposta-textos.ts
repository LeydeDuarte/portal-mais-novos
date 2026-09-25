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

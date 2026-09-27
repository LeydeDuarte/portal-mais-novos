// Construtoras e incorporadoras (perfil informativo). Tipos e textos comuns.
export type PapelEmpresa = 'construtora' | 'incorporadora' | 'construtora_incorporadora';
export const PAPEL_LABEL: Record<PapelEmpresa, string> = {
  construtora: 'Construtora',
  incorporadora: 'Incorporadora',
  construtora_incorporadora: 'Construtora e incorporadora'
};

export type Empresa = {
  id: string;
  cnpj: string | null; // 14 dígitos; null = cadastrada só pelo nome (ex.: importação de PDF), CNPJ a completar
  razaoSocial: string;
  nomeFantasia: string | null;
  slug: string;
  situacao: string | null; // ATIVA, SUSPENSA, INAPTA, BAIXADA, NULA
  dataSituacao: string | null; // AAAA-MM-DD
  dataInicio: string | null; // AAAA-MM-DD (abertura)
  municipio: string | null;
  uf: string | null;
  atividade: string | null;
  historico: string | null;
  receitaAtualizadaEm: string | null;
  totalEmpreendimentos?: number;
};

export type EmpresaNaConcepcao = { empresaId: string; papel: PapelEmpresa };
export type ConcepcaoItem = { empresa: Empresa; papel: PapelEmpresa };

export const nomeEmpresa = (e: Pick<Empresa, 'nomeFantasia' | 'razaoSocial'>) => (e.nomeFantasia?.trim() ? e.nomeFantasia : e.razaoSocial);
export const empresaAtiva = (e: Pick<Empresa, 'situacao'>) => !e.situacao || e.situacao.toUpperCase() === 'ATIVA';
export const formatarCnpj = (c: string | null | undefined) => (c ?? '').replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/** "Ativa desde 03/11/2005", "Baixada desde 10/02/2020"… */
export function textoSituacao(e: Pick<Empresa, 'situacao' | 'dataSituacao'>): string | null {
  if (!e.situacao) return null;
  const s = e.situacao.charAt(0).toUpperCase() + e.situacao.slice(1).toLowerCase();
  return e.dataSituacao ? `${s} desde ${dataBR(e.dataSituacao)}` : s;
}

/** Idade da empresa pela data de abertura no CNPJ */
export function idadeEmpresa(dataInicio: string | null, hoje = new Date()): { anos: number; texto: string } | null {
  if (!dataInicio) return null;
  const d = new Date(`${dataInicio.slice(0, 10)}T00:00:00`);
  let anos = hoje.getFullYear() - d.getFullYear();
  if (hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) anos--;
  return { anos, texto: anos < 1 ? 'menos de 1 ano' : anos === 1 ? '1 ano' : `${anos} anos` };
}

export function cnpjValido(c: string): boolean {
  const d = c.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + Number(d[i]) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

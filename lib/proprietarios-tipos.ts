// Tipos e regras do cadastro de proprietários (sem acesso ao banco: pode ir para o navegador)

export type Proprietario = {
  id: string;
  tipo: 'pf' | 'pj';
  nome: string;
  documento: string | null;
  whatsapp: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  empresaId: string | null;
  observacao: string | null;
  // cadastro completo (para a proposta já sair preenchida)
  rg: string | null;
  nascimento: string | null; // AAAA-MM-DD
  estadoCivil: string | null;
  regimeBens: string | null;
  profissao: string | null;
  nacionalidade: string | null;
  representante: string | null; // empresa: quem assina (nome e cargo)
  conjuge: Conjuge | null;
  imoveis?: number;
};
export type Conjuge = {
  nome: string;
  documento?: string | null;
  rg?: string | null;
  nascimento?: string | null;
  profissao?: string | null;
  nacionalidade?: string | null;
  telefone?: string | null;
  email?: string | null;
};

export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Separado(a)', 'Viúvo(a)'];
export const REGIMES_BENS = ['Comunhão parcial de bens', 'Comunhão universal de bens', 'Separação total de bens', 'Participação final nos aquestos'];
/** Estado civil em que o cônjuge/companheiro também assina a venda */
export const temConjuge = (estadoCivil?: string | null) => /casad|uni[aã]o/i.test(estadoCivil ?? '');

/** O que falta para a proposta sair 100% preenchida (lista vazia = cadastro completo) */
export function faltandoNoCadastro(p: Pick<Proprietario, 'tipo' | 'documento' | 'whatsapp' | 'email' | 'endereco' | 'cidade' | 'rg' | 'estadoCivil' | 'profissao' | 'representante' | 'conjuge'>): string[] {
  const f: string[] = [];
  if (!p.documento) f.push(p.tipo === 'pj' ? 'CNPJ' : 'CPF');
  if (!p.whatsapp) f.push('telefone');
  if (!p.email) f.push('e-mail');
  if (!p.endereco || !p.cidade) f.push('endereço');
  if (p.tipo === 'pj') {
    if (!p.representante) f.push('representante');
  } else {
    if (!p.rg) f.push('RG');
    if (!p.estadoCivil) f.push('estado civil');
    if (!p.profissao) f.push('profissão');
    if (temConjuge(p.estadoCivil) && !p.conjuge?.nome) f.push('cônjuge');
  }
  return f;
}


/** Pessoa(s) que vão na proposta como vendedor: o proprietário e, se casado/união estável, o cônjuge */
export function pessoasDaProposta(o: Proprietario) {
  const base = {
    nome: o.nome,
    documento: o.documento ?? undefined,
    rg: o.rg ?? undefined,
    nascimento: o.nascimento ?? undefined,
    estadoCivil: [o.estadoCivil, temConjuge(o.estadoCivil) ? o.regimeBens : null].filter(Boolean).join(', ') || undefined,
    profissao: o.profissao ?? undefined,
    telefone: o.whatsapp ?? undefined,
    email: o.email ?? undefined,
    cep: o.cep ?? undefined,
    endereco: o.endereco ?? undefined,
    bairro: o.bairro ?? undefined,
    cidade: o.cidade ?? undefined,
    uf: o.uf ?? undefined,
    representante: o.representante ?? undefined
  };
  const lista = [base];
  if (o.tipo === 'pf' && temConjuge(o.estadoCivil) && o.conjuge?.nome) {
    lista.push({
      ...base,
      nome: o.conjuge.nome,
      documento: o.conjuge.documento ?? undefined,
      rg: o.conjuge.rg ?? undefined,
      nascimento: o.conjuge.nascimento ?? undefined,
      profissao: o.conjuge.profissao ?? undefined,
      telefone: o.conjuge.telefone ?? undefined,
      email: o.conjuge.email ?? undefined,
      representante: undefined
    });
  }
  return lista;
}


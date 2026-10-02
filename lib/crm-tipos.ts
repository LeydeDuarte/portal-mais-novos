// Tipos e listas do CRM que também servem no navegador (sem acesso ao banco).
export type Funil = 'comprar' | 'vender' | 'credito' | 'alugar' | 'parceiros';
export const FUNIS: { id: Funil; nome: string }[] = [
  { id: 'comprar', nome: 'Comprar' },
  { id: 'vender', nome: 'Vender (captação)' },
  { id: 'credito', nome: 'Crédito (Mais Valor)' },
  { id: 'alugar', nome: 'Alugar' },
  { id: 'parceiros', nome: 'Corretores parceiros' }
];
export const ETAPAS: Record<Funil, { id: string; nome: string }[]> = {
  comprar: [
    { id: 'novo', nome: 'Novo' },
    { id: 'atendimento', nome: 'Em atendimento' },
    { id: 'visita', nome: 'Visita' },
    { id: 'proposta', nome: 'Proposta' },
    { id: 'negociacao', nome: 'Negociação e crédito' }
  ],
  vender: [
    { id: 'novo', nome: 'Novo' },
    { id: 'atendimento', nome: 'Em conversa' },
    { id: 'avaliacao', nome: 'Avaliação no local' },
    { id: 'documentos', nome: 'Documentos' },
    { id: 'anunciado', nome: 'Anunciado' }
  ],
  credito: [
    { id: 'novo', nome: 'Novo' },
    { id: 'simulacao', nome: 'Simulação' },
    { id: 'documentos', nome: 'Documentos' },
    { id: 'analise', nome: 'Análise no banco' },
    { id: 'aprovado', nome: 'Aprovado' }
  ],
  alugar: [
    { id: 'novo', nome: 'Novo' },
    { id: 'atendimento', nome: 'Em atendimento' },
    { id: 'visita', nome: 'Visita' },
    { id: 'contrato', nome: 'Contrato' }
  ],
  parceiros: [
    { id: 'novo', nome: 'Novo' },
    { id: 'creci', nome: 'Conferir CRECI' },
    { id: 'parceria', nome: 'Parceria proposta' },
    { id: 'visita', nome: 'Visita com o cliente dele' }
  ]
};
export const etapaValida = (f: string, e: string) => e === 'ganho' || e === 'perdido' || !!ETAPAS[f as Funil]?.some((x) => x.id === e);

export type PassoJornada = { quando: string; pagina: string; titulo: string; segundos: number; tipo: string };
export type ResumoPortal = { paginas: number; segundos: number; condominios: number; imoveis: number; simulacoes: number; propostas: number; voltas: number; desde: string | null };

export type Nota = { valor: number; faixa: 'quente' | 'morno' | 'frio'; motivos: string[] };

/** como chegou, para contatos cadastrados à mão */
export const CANAIS_MANUAIS = ['Indicação', 'Ligação', 'Plantão', 'Instagram (direct)', 'WhatsApp da empresa', 'Facebook', 'TikTok', 'Placa ou panfleto', 'Outro'];

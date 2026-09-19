import { TIPO_UNIDADE_LABEL, type TipoUnidade } from './tipologias';

// Gerador simples de título de anúncio — mesmo princípio do resto do
// reconhecimento de padrão: template, não IA generativa de verdade. O
// documento de arquitetura já descreve como isso vira um prompt de
// copywriting/SEO de verdade quando o módulo de IA for conectado.
export function generateTitle(params: {
  tipoUnidade: TipoUnidade;
  finalidade: 'venda' | 'aluguel';
  location: string;
  quartos?: string;
}): string {
  const tipo = TIPO_UNIDADE_LABEL[params.tipoUnidade];
  const acao = params.finalidade === 'aluguel' ? 'para alugar' : 'à venda';
  const local = params.location || 'Goiânia';
  const quartosParte = params.quartos ? ` de ${params.quartos} quartos` : '';
  return `${tipo}${quartosParte} ${acao} em ${local}`;
}

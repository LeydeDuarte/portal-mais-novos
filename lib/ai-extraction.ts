import { AMENIDADES_PADRAO } from './amenidades';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from './tipologias';

// Extração por reconhecimento de padrão (regex) — NÃO é o módulo de IA
// generativa descrito no documento de arquitetura. Serve pra demonstrar o
// fluxo (colar texto → rascunho pré-preenchido → revisão → publica) sem
// precisar de uma chave de API paga conectada. Trocar por uma chamada de IA
// de verdade é só substituir o corpo desta função — a tela de revisão e o
// resto do fluxo não mudam.
export type ExtractedFields = {
  price?: string;
  area?: string;
  quartos?: string;
  vagas?: string;
  banheiros?: string;
  tipoUnidade?: TipoUnidade;
  finalidade?: 'venda' | 'aluguel';
  aceitaTemporada?: boolean;
  amenities?: string[];
  location?: string;
};

function findNumber(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match ? match[1] : undefined;
}

export function extractFieldsFromText(text: string): ExtractedFields {
  const lower = text.toLowerCase();
  const result: ExtractedFields = {};

  const priceMatch = text.match(/R\$\s?[\d.,]+(?:\/m[eê]s)?/i);
  if (priceMatch) result.price = priceMatch[0];

  result.area = findNumber(text, /(\d+)\s?m²/);
  result.quartos = findNumber(text, /(\d+)\s?(?:quartos?|qts?|dormit[oó]rios?)/i);
  result.vagas = findNumber(text, /(\d+)\s?(?:vagas?|vg)/i);
  result.banheiros = findNumber(text, /(\d+)\s?banheiros?/i);

  result.finalidade = /aluguel|locação|alugar/.test(lower) ? 'aluguel' : 'venda';
  result.aceitaTemporada = /temporada/.test(lower);

  for (const tipo of Object.keys(TIPO_UNIDADE_LABEL) as TipoUnidade[]) {
    if (lower.includes(TIPO_UNIDADE_LABEL[tipo].toLowerCase())) {
      result.tipoUnidade = tipo;
      break;
    }
  }

  const foundAmenities = AMENIDADES_PADRAO.filter((a) => lower.includes(a.toLowerCase()));
  if (foundAmenities.length > 0) result.amenities = foundAmenities;

  const locationMatch = text.match(/(setor|jardim|residencial|vila|parque)\s+[\wáàâãéêíóôõúüç]+(?:,\s*Goiânia\s*—?\s*GO)?/i);
  if (locationMatch) result.location = locationMatch[0];

  return result;
}

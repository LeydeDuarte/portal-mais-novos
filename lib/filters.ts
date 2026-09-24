import type { Property } from './mock-properties';
import type { TipoUnidade } from './tipologias';
import { getStatusBucket, type StatusBucket } from './classification';

export type FilterState = {
  finalidade: 'todas' | 'venda' | 'aluguel';
  tipoUnidade: 'todas' | TipoUnidade;
  precoMax: 'todas' | 500000 | 1000000 | 2000000; // "até X" — acima do maior valor = sem teto
  quartosMin: 'todas' | 1 | 2 | 3 | 4;
  vagasMin: 'todas' | 1 | 2 | 3;
  situacao: 'todas' | StatusBucket;
  aceitaTemporada: 'todas' | 'sim';
  // "todos" = feed geral do Comprar; "lancamentos" = só empreendimentos
  // (condomínios cadastrados) e imóveis avulsos com entrega no futuro.
  modo: 'todos' | 'lancamentos';
  // Busca livre: bairro, cidade, nome do condomínio/empreendimento, tipo...
  q: string;
  // Ano de entrega — um ano só (mínimo = máximo) ou uma faixa (ex: 2020 a 2025)
  anoMin: number | null;
  anoMax: number | null;
};

export const DEFAULT_FILTERS: FilterState = {
  finalidade: 'todas',
  tipoUnidade: 'todas',
  precoMax: 'todas',
  quartosMin: 'todas',
  vagasMin: 'todas',
  situacao: 'todas',
  aceitaTemporada: 'todas',
  modo: 'todos',
  q: '',
  anoMin: null,
  anoMax: null
};

export function countActiveFilters(f: FilterState): number {
  return (Object.keys(DEFAULT_FILTERS) as (keyof FilterState)[]).filter((k) => k !== 'modo' && f[k] !== DEFAULT_FILTERS[k]).length;
}

function parsePriceBRL(price: string): number {
  const cleaned = price.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  return Number(cleaned) || 0;
}

// Os campos "beds"/"parking" são texto livre pensado pra leitura humana
// ("3 qts", "4 qts (4 suítes)", "2 ambientes") — pra filtrar, lê só o
// primeiro número como aproximação. Suficiente pro protótipo; a API real
// teria campos numéricos próprios (ver documento de arquitetura).
function firstNumber(text: string): number {
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function matchesFilters(property: Property, filters: FilterState): boolean {
  if (filters.finalidade !== 'todas' && property.finalidade !== filters.finalidade) return false;
  if (filters.tipoUnidade !== 'todas' && property.tipoUnidade !== filters.tipoUnidade) return false;
  if (filters.precoMax !== 'todas' && parsePriceBRL(property.price) > filters.precoMax) return false;
  if (filters.quartosMin !== 'todas' && firstNumber(property.beds) < filters.quartosMin) return false;
  if (filters.vagasMin !== 'todas' && firstNumber(property.parking) < filters.vagasMin) return false;
  if (filters.situacao !== 'todas' && getStatusBucket(property.deliveryDate) !== filters.situacao) return false;
  if (filters.aceitaTemporada === 'sim' && !property.aceitaTemporada) return false;
  return true;
}

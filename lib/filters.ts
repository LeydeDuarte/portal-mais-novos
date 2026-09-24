import type { TipoUnidade } from './tipologias';
import type { StatusBucket } from './classification';

// Local escolhido na lista da busca (só existem locais com anúncio publicado)
export type LocalFiltro = { tipo: 'cidade' | 'bairro' | 'condominio'; nome: string; cidade: string; uf: string; id?: string };

export const localKey = (l: LocalFiltro) => `${l.tipo}|${l.id ?? ''}|${l.nome}|${l.cidade}`.toLowerCase();

export type FilterState = {
  finalidade: 'todas' | 'venda' | 'aluguel';
  // Vários tipos ao mesmo tempo (ex: Casa + Sobrado + Casa em Condomínio). Vazio = todos.
  tipos: TipoUnidade[];
  // Faixa de preço "de / até" (null = sem limite daquele lado)
  precoMin: number | null;
  precoMax: number | null;
  // Metragem "de / até", em m²
  areaMin: number | null;
  areaMax: number | null;
  quartosMin: 'todas' | 1 | 2 | 3 | 4;
  vagasMin: 'todas' | 1 | 2 | 3;
  situacao: 'todas' | StatusBucket;
  aceitaTemporada: 'todas' | 'sim';
  // "todos" = feed geral do Comprar; "lancamentos" = só empreendimentos
  // (condomínios cadastrados) e imóveis avulsos com entrega no futuro.
  modo: 'todos' | 'lancamentos';
  // Busca livre em balõezinhos: cada termo é um balão (ex: "marista", "bueno").
  // Entre balões vale "OU" (Marista OU Bueno); dentro de um balão, todas as
  // palavras precisam bater (ex: "cobertura jardim goiás").
  termos: string[];
  // Locais marcados (cidade, bairro ou condomínio) — entre eles vale "OU"
  locais: LocalFiltro[];
  // Ano de entrega — um ano só (mínimo = máximo) ou uma faixa (ex: 2020 a 2025)
  anoMin: number | null;
  anoMax: number | null;
};

export const DEFAULT_FILTERS: FilterState = {
  finalidade: 'todas',
  tipos: [],
  precoMin: null,
  precoMax: null,
  areaMin: null,
  areaMax: null,
  quartosMin: 'todas',
  vagasMin: 'todas',
  situacao: 'todas',
  aceitaTemporada: 'todas',
  modo: 'todos',
  termos: [],
  locais: [],
  anoMin: null,
  anoMax: null
};

// Quantos filtros estão ativos (o modo Todos/Lançamentos não conta)
export function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.finalidade !== 'todas') n++;
  if (f.tipos.length) n++;
  if (f.precoMin || f.precoMax) n++;
  if (f.areaMin || f.areaMax) n++;
  if (f.quartosMin !== 'todas') n++;
  if (f.vagasMin !== 'todas') n++;
  if (f.situacao !== 'todas') n++;
  if (f.aceitaTemporada !== 'todas') n++;
  if (f.anoMin || f.anoMax) n++;
  n += f.termos.length + f.locais.length;
  return n;
}

// Separa o que a pessoa digitou em balões: vírgula ou ponto e vírgula = balões diferentes
export function splitTermos(texto: string): string[] {
  return texto
    .split(/[,;]+/)
    .map((t) => t.trim().replace(/\s+/g, ' '))
    .filter((t) => t.length >= 2)
    .slice(0, 8);
}

export function addTermos(atuais: string[], novos: string[]): string[] {
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const out = [...atuais];
  for (const t of novos) if (!out.some((x) => norm(x) === norm(t))) out.push(t);
  return out.slice(0, 8);
}

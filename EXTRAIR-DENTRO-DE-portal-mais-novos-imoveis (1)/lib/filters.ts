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
  // Quartos, vagas e banheiros: vários valores ao mesmo tempo, de 0 a 4
  // (4 = 4 ou mais; 0 = sem quartos, ex. sala comercial). Vazio = todos.
  quartos: number[];
  vagas: number[];
  banheiros: number[];
  // Fases marcadas (várias ao mesmo tempo; vale "OU"). Vazio = todas.
  situacao: StatusBucket[];
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
  quartos: [],
  vagas: [],
  banheiros: [],
  situacao: [],
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
  if (f.quartos?.length) n++;
  if (f.vagas?.length) n++;
  if (f.banheiros?.length) n++;
  if (f.situacao?.length) n++;
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

// Rótulo dos botões de 0 a 4 (o 4 vale "4 ou mais")
export const NUMEROS_FILTRO = [0, 1, 2, 3, 4] as const;
export const rotuloNumero = (n: number) => (n >= 4 ? '4+' : String(n));
export const alternarNumero = (lista: number[] | undefined, n: number) =>
  (lista ?? []).includes(n) ? (lista ?? []).filter((x) => x !== n) : [...(lista ?? []), n].sort((a, b) => a - b);

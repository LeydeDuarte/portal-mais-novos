// Taxonomia padronizada de tipo de unidade — alinhada com o que os grandes
// portais (Viva Real, ZAP, Lopes) já usam, pra manter os cadastros homogêneos
// independente de quem cadastrou (corretor manual ou o módulo de IA).

export type TipoUnidade =
  // residencial — compacto
  | 'studio'
  | 'flat'
  | 'loft'
  // residencial — apartamento
  | 'apartamento'
  | 'apartamento_garden'
  | 'apartamento_duplex'
  | 'apartamento_triplex'
  // residencial — alto padrão
  | 'cobertura'
  | 'cobertura_duplex'
  | 'penthouse'
  // residencial — casa
  | 'casa'
  | 'casa_condominio'
  | 'sobrado'
  | 'chacara_sitio_fazenda'
  | 'terreno_lote'
  // comercial
  | 'sala_comercial'
  | 'loja_ponto_comercial'
  | 'galpao'
  | 'predio_comercial';

export const TIPO_UNIDADE_LABEL: Record<TipoUnidade, string> = {
  studio: 'Studio',
  flat: 'Flat',
  loft: 'Loft',
  apartamento: 'Apartamento',
  apartamento_garden: 'Apartamento Garden',
  apartamento_duplex: 'Apartamento Duplex',
  apartamento_triplex: 'Apartamento Triplex',
  cobertura: 'Cobertura',
  cobertura_duplex: 'Cobertura Duplex',
  penthouse: 'Penthouse',
  casa: 'Casa',
  casa_condominio: 'Casa em Condomínio',
  sobrado: 'Sobrado',
  chacara_sitio_fazenda: 'Chácara/Sítio/Fazenda',
  terreno_lote: 'Terreno/Lote',
  sala_comercial: 'Sala Comercial',
  loja_ponto_comercial: 'Loja/Ponto Comercial',
  galpao: 'Galpão',
  predio_comercial: 'Prédio Comercial'
};

// Agrupamento usado no filtro "Tipo de imóvel" — mantém as opções organizadas
// por categoria em vez de uma lista solta de 18 itens.
export const TIPO_UNIDADE_GRUPOS: { label: string; tipos: TipoUnidade[] }[] = [
  { label: 'Compacto', tipos: ['studio', 'flat', 'loft'] },
  { label: 'Apartamento', tipos: ['apartamento', 'apartamento_garden', 'apartamento_duplex', 'apartamento_triplex'] },
  { label: 'Alto padrão', tipos: ['cobertura', 'cobertura_duplex', 'penthouse'] },
  { label: 'Casa', tipos: ['casa', 'casa_condominio', 'sobrado', 'chacara_sitio_fazenda', 'terreno_lote'] },
  { label: 'Comercial', tipos: ['sala_comercial', 'loja_ponto_comercial', 'galpao', 'predio_comercial'] }
];

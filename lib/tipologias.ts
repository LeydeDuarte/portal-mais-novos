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

// Tipo mais específico do vocabulário schema.org pra cada tipo de unidade —
// usado junto do "RealEstateListing" no dado estruturado (Schema Markup) de
// cada imóvel, pra descrever o imóvel em si, não só o anúncio dele.
export const TIPO_UNIDADE_SCHEMA_ORG: Record<TipoUnidade, string> = {
  studio: 'Apartment',
  flat: 'Apartment',
  loft: 'Apartment',
  apartamento: 'Apartment',
  apartamento_garden: 'Apartment',
  apartamento_duplex: 'Apartment',
  apartamento_triplex: 'Apartment',
  cobertura: 'Apartment',
  cobertura_duplex: 'Apartment',
  penthouse: 'Apartment',
  casa: 'SingleFamilyResidence',
  casa_condominio: 'SingleFamilyResidence',
  sobrado: 'SingleFamilyResidence',
  chacara_sitio_fazenda: 'SingleFamilyResidence',
  terreno_lote: 'Place', // schema.org não tem um tipo específico pra terreno/lote vazio
  sala_comercial: 'Place', // idem para comercial — sem tipo residencial específico que se aplique
  loja_ponto_comercial: 'Place',
  galpao: 'Place',
  predio_comercial: 'Place'
};

// Casas e lotes: a idade é a da CASA (ano de entrega/habite-se da própria casa),
// nunca a do condomínio horizontal onde ela fica — um condomínio de 1999 pode ter casa nova.
export const TIPOS_CASA: TipoUnidade[] = ['casa', 'casa_condominio', 'sobrado', 'chacara_sitio_fazenda', 'terreno_lote'];
export const ehCasa = (t?: string | null) => !!t && (TIPOS_CASA as string[]).includes(t);

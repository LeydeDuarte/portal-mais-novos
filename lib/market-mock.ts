import type { TipoUnidade } from './tipologias';

// Dados de EXEMPLO — protótipo do painel de monitoramento, sem nenhuma fonte
// de dados real conectada ainda. Em produção isso viria de uma fonte
// legítima (parceria/feed de dados, nunca scraping de fotos de terceiros —
// ver "Monitoramento de imóveis recém-anunciados no mercado" no documento
// de arquitetura). O nome da fonte aqui é só um rótulo genérico de exemplo.
export type MarketReference = {
  id: string;
  cidade: string;
  bairro: string;
  tipoUnidade: TipoUnidade;
  precoAproximado: string;
  areaAproximada: string;
  quartos: string;
  fonte: string;
  observacao: string;
};

export const CIDADES_MONITORADAS = ['Goiânia', 'Aparecida de Goiânia', 'Trindade', 'Senador Canedo'];

export const MARKET_REFERENCES: MarketReference[] = [
  { id: 'ref-1', cidade: 'Goiânia', bairro: 'Setor Bueno', tipoUnidade: 'apartamento', precoAproximado: 'R$ 850.000 (aprox.)', areaAproximada: '~110 m²', quartos: '3', fonte: 'Portal parceiro A (exemplo)', observacao: 'Anúncio novo, sem correspondência na nossa base' },
  { id: 'ref-2', cidade: 'Goiânia', bairro: 'Jardim Goiás', tipoUnidade: 'cobertura', precoAproximado: 'R$ 2.300.000 (aprox.)', areaAproximada: '~290 m²', quartos: '4', fonte: 'Portal parceiro B (exemplo)', observacao: 'Anúncio novo, sem correspondência na nossa base' },
  { id: 'ref-3', cidade: 'Goiânia', bairro: 'Setor Marista', tipoUnidade: 'penthouse', precoAproximado: 'R$ 4.100.000 (aprox.)', areaAproximada: '~350 m²', quartos: '4', fonte: 'Portal parceiro A (exemplo)', observacao: 'Anúncio novo, sem correspondência na nossa base' },
  { id: 'ref-4', cidade: 'Aparecida de Goiânia', bairro: 'Buriti Sereno', tipoUnidade: 'casa_condominio', precoAproximado: 'R$ 690.000 (aprox.)', areaAproximada: '~180 m²', quartos: '3', fonte: 'Portal parceiro C (exemplo)', observacao: 'Anúncio novo, sem correspondência na nossa base' },
  { id: 'ref-5', cidade: 'Aparecida de Goiânia', bairro: 'Vila Brasília', tipoUnidade: 'apartamento', precoAproximado: 'R$ 320.000 (aprox.)', areaAproximada: '~65 m²', quartos: '2', fonte: 'Portal parceiro B (exemplo)', observacao: 'Anúncio novo, sem correspondência na nossa base' },
  { id: 'ref-6', cidade: 'Trindade', bairro: 'Centro', tipoUnidade: 'sala_comercial', precoAproximado: 'R$ 410.000 (aprox.)', areaAproximada: '~60 m²', quartos: '-', fonte: 'Portal parceiro A (exemplo)', observacao: 'Anúncio novo, sem correspondência na nossa base' },
  { id: 'ref-7', cidade: 'Senador Canedo', bairro: 'Jardim Bela Vista', tipoUnidade: 'terreno_lote', precoAproximado: 'R$ 180.000 (aprox.)', areaAproximada: '~400 m²', quartos: '-', fonte: 'Portal parceiro C (exemplo)', observacao: 'Anúncio novo, sem correspondência na nossa base' }
];

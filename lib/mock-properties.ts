import type { TipoUnidade } from './tipologias';

export type Property = {
  id: string;
  tipoUnidade: TipoUnidade;
  finalidade: 'venda' | 'aluguel';
  // "AAAA-MM" — data de entrega do imóvel/empreendimento. A etiqueta de
  // lançamento/usado nunca é armazenada; é sempre calculada a partir daqui
  // (ver lib/classification.ts).
  deliveryDate: string;
  price: string;
  location: string;
  beds: string;
  parking: string;
  // Opcionais — só os imóveis cadastrados pelo painel novo preenchem;
  // o catálogo de exemplo mais antigo fica sem, e a exibição já trata isso.
  banheiros?: string;
  escaninhos?: string; // depósito/escaninho privativo, comum em prédios
  titulo?: string; // título do anúncio — se não tiver, gera um genérico na exibição
  videoVertical?: boolean; // vídeo gravado em pé (celular)
  videoUrl?: string; // link do YouTube/Instagram, quando "Tem vídeo de capa" está marcado
  area: string;
  // Valores numéricos (quando vêm do banco) — usados em cálculos como o preço médio do m²
  priceValue?: number;
  areaValue?: number;
  // Fotos reais (URLs no R2) — a primeira é a capa. Vazio = mostra o espaço reservado.
  photos?: string[];
  plantas?: string[]; // imagens da planta da unidade
  capaMini?: string; // miniatura WebP 640 px da capa (feed)
  visualizacoes?: number; // quantas vezes o anúncio foi aberto (foguinho no card)
  vendidoEm?: string; // marcado como vendido: fica 15 dias no feed com a tag VENDIDO
  visibilidade?: 'publico' | 'privado'; // privado = portfólio, fora do feed (só pelo link privado)
  condominio?: string; // nome do condomínio/edifício, quando o imóvel fica em um
  bairro?: string;
  cidade?: string;
  isTipologia?: boolean; // linha da tabela de vendas de um empreendimento (não é um anúncio avulso)
  height: number;
  video: boolean;
  // Selo "Aceita temporada" — sim/não, definido no cadastro (regra do
  // condomínio ou do próprio anúncio, quando permite locação por temporada).
  aceitaTemporada: boolean;
  // matchScore é onde o motor de recomendação (ver documento de arquitetura) entraria de
  // verdade — aqui é um valor mockado só para demonstrar a priorização do autoplay/feed.
  matchScore: number;
};

export const BASE_PROPERTIES: Property[] = [
  { id: 'p1', tipoUnidade: 'apartamento', finalidade: 'venda', deliveryDate: '2021-06', price: 'R$ 890.000', location: 'Setor Bueno, Goiânia — GO', beds: '3 qts', parking: '2 vg', area: '120 m²', height: 260, video: false, aceitaTemporada: false, matchScore: 62 },
  { id: 'p2', tipoUnidade: 'cobertura', finalidade: 'venda', deliveryDate: '2020-11', price: 'R$ 1.250.000', location: 'Jardim Goiás, Goiânia — GO', beds: '4 qts', parking: '3 vg', area: '280 m²', height: 340, video: true, aceitaTemporada: true, matchScore: 91 },
  { id: 'p3', tipoUnidade: 'apartamento_duplex', finalidade: 'venda', deliveryDate: '2027-06', price: 'R$ 2.100.000', location: 'Setor Marista, Goiânia — GO', beds: '3 qts', parking: '4 vg', area: '210 m²', height: 200, video: true, aceitaTemporada: false, matchScore: 78 },
  { id: 'p4', tipoUnidade: 'apartamento', finalidade: 'aluguel', deliveryDate: '2019-01', price: 'R$ 6.500/mês', location: 'Setor Oeste, Goiânia — GO', beds: '2 qts', parking: '1 vg', area: '85 m²', height: 300, video: false, aceitaTemporada: true, matchScore: 45 },
  { id: 'p5', tipoUnidade: 'casa_condominio', finalidade: 'venda', deliveryDate: '2021-05', price: 'R$ 3.400.000', location: 'Alphaville Flamboyant — GO', beds: '5 qts', parking: '4 vg', area: '420 m²', height: 230, video: true, aceitaTemporada: false, matchScore: 96 },
  { id: 'p6', tipoUnidade: 'apartamento', finalidade: 'venda', deliveryDate: '2018-09', price: 'R$ 650.000', location: 'Setor Nova Suíça, Goiânia — GO', beds: '2 qts', parking: '1 vg', area: '68 m²', height: 280, video: false, aceitaTemporada: false, matchScore: 38 },
  { id: 'p7', tipoUnidade: 'apartamento', finalidade: 'venda', deliveryDate: '2026-12', price: 'R$ 980.000', location: 'Setor Bueno, Goiânia — GO', beds: '3 qts', parking: '2 vg', area: '105 m²', height: 240, video: false, aceitaTemporada: false, matchScore: 55 },
  { id: 'p8', tipoUnidade: 'cobertura_duplex', finalidade: 'venda', deliveryDate: '2022-03', price: 'R$ 1.780.000', location: 'Jardim Goiás, Goiânia — GO', beds: '4 qts', parking: '3 vg', area: '260 m²', height: 320, video: true, aceitaTemporada: false, matchScore: 83 },
  { id: 'p9', tipoUnidade: 'apartamento', finalidade: 'venda', deliveryDate: '2019-11', price: 'R$ 720.000', location: 'Setor Pedro Ludovico, Goiânia — GO', beds: '3 qts', parking: '2 vg', area: '98 m²', height: 210, video: false, aceitaTemporada: false, matchScore: 41 },
  { id: 'p10', tipoUnidade: 'flat', finalidade: 'aluguel', deliveryDate: '2017-04', price: 'R$ 4.200/mês', location: 'Setor Bela Vista, Goiânia — GO', beds: '2 qts', parking: '1 vg', area: '72 m²', height: 270, video: false, aceitaTemporada: true, matchScore: 33 },
  { id: 'p11', tipoUnidade: 'apartamento', finalidade: 'venda', deliveryDate: '2020-08', price: 'R$ 1.050.000', location: 'Setor Marista, Goiânia — GO', beds: '3 qts', parking: '2 vg', area: '115 m²', height: 250, video: true, aceitaTemporada: false, matchScore: 70 },
  { id: 'p12', tipoUnidade: 'loft', finalidade: 'venda', deliveryDate: '2028-03', price: 'R$ 890.000', location: 'Vila Rosa, Goiânia — GO', beds: '2 qts', parking: '2 vg', area: '78 m²', height: 300, video: false, aceitaTemporada: false, matchScore: 48 },
  { id: 'p13', tipoUnidade: 'penthouse', finalidade: 'venda', deliveryDate: '2019-02', price: 'R$ 4.900.000', location: 'Setor Marista, Goiânia — GO', beds: '4 qts (4 suítes)', parking: '5 vg', area: '380 m²', height: 260, video: true, aceitaTemporada: true, matchScore: 89 },
  { id: 'p14', tipoUnidade: 'sala_comercial', finalidade: 'venda', deliveryDate: '2023-05', price: 'R$ 480.000', location: 'Setor Oeste, Goiânia — GO', beds: '2 ambientes', parking: '1 vg', area: '52 m²', height: 220, video: false, aceitaTemporada: false, matchScore: 30 }
];

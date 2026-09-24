import type { TipoUnidade } from './tipologias';
import { BASE_PROPERTIES, type Property } from './mock-properties';

export type PropertyDetail = Property & {
  description: string;
  amenities: string[];
  empreendimentoId?: string;
  // Preenchido só nos imóveis cadastrados pelo painel do corretor — quem
  // cadastrou. Nos imóveis do catálogo de exemplo, fica indefinido.
  corretorEmail?: string;
};

export type Development = {
  id: string;
  name: string;
  location: string;
  deliveryDate: string; // "AAAA-MM" — mesma regra de classificação do imóvel avulso
  deliveryNote: string; // texto de exibição, ex: "Previsão de entrega: dezembro de 2027"
  description: string;
  tipo: 'vertical' | 'horizontal';
  pavimentos?: number; // só faz sentido para 'vertical'
  areaTerreno?: string; // ex: "3.200 m²" — sobretudo relevante em 'horizontal'
  amenities: string[];
  // Selo "Aceita temporada" — regra do condomínio, sim/não, cadastrada uma
  // vez para o empreendimento inteiro (vale para todas as unidades nele).
  aceitaTemporada: boolean;
  heroHeight: number;
  videoUrl?: string;
  photos?: string[]; // fachada, área comum — a primeira é a capa
  // Tipos de imóvel que existem no empreendimento (casa, sobrado, apartamento...),
  // marcados no cadastro mesmo sem detalhar cada tipologia — é o que alimenta o filtro.
  tiposUnidade?: TipoUnidade[];
  quartosOpcoes?: number[]; // opções de quartos conhecidas (ex: [2, 3, 4]), sem precisar de metragem/preço
  bairro?: string;
  cidade?: string;
  cep?: string;
  corretorEmail?: string; // preenchido só nos condomínios cadastrados pelo painel
  units: PropertyDetail[]; // cada unit = uma tipologia (metragem/quartos/valor próprios) — inclui as vinculadas depois via imóvel avulso
};

// Preço médio do m² do empreendimento — nunca cadastrado, sempre calculado a
// partir do valor e da área de cada tipologia (mesma lógica de nunca digitar
// à mão o que dá pra derivar — ver "Modelo de dados do empreendimento").
function parseAreaM2(area: string): number {
  const cleaned = area.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  return Number(cleaned);
}

function parsePriceBRL(price: string): number {
  const cleaned = price.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  return Number(cleaned);
}

export function getAveragePricePerM2(units: PropertyDetail[]): number {
  const values = units
    .map((u) => parsePriceBRL(u.price) / parseAreaM2(u.area))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function formatPricePerM2(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) + '/m²';
}

// Placeholder de comodidades — no cadastro real (manual ou via IA), isso vem do
// próprio anúncio; aqui é só para a página de detalhe ter conteúdo para mostrar.
const COMMON_AMENITIES = ['Portaria 24h', 'Elevador', 'Área de lazer', 'Vaga coberta'];

function buildDescription(p: Property): string {
  const acao = p.finalidade === 'aluguel' ? 'disponível para locação' : 'à venda';
  return `Imóvel ${acao} em ${p.location}, com ${p.beds}, ${p.parking} e ${p.area} de área privativa. Endereço completo e mais fotos disponíveis com o corretor responsável.`;
}

function isPropertyDetail(p: Property | PropertyDetail): p is PropertyDetail {
  return 'description' in p;
}

export const DEVELOPMENTS: Development[] = [
  {
    id: 'jardins-do-cerrado',
    name: 'Residencial Jardins do Cerrado',
    location: 'Jardim Goiás, Goiânia — GO',
    deliveryDate: '2027-12',
    deliveryNote: 'Previsão de entrega: dezembro de 2027',
    description:
      'Empreendimento em Jardim Goiás com unidades de 2 e 3 quartos, área de lazer completa e a poucos minutos do Parque Flamboyant. Ainda em fase de lançamento — condições especiais de tabela para as primeiras unidades vendidas.',
    tipo: 'vertical',
    pavimentos: 18,
    amenities: ['Piscina', 'Academia', 'Salão de festas', 'Playground', 'Portaria 24h', 'Bicicletário'],
    aceitaTemporada: true,
    heroHeight: 340,
    units: [
      {
        id: 'jardins-do-cerrado-2q',
        tipoUnidade: 'apartamento',
        finalidade: 'venda',
        deliveryDate: '2027-12',
        price: 'R$ 780.000',
        location: 'Jardim Goiás, Goiânia — GO',
        beds: '2 qts',
        parking: '2 vg',
        area: '68 m²',
        height: 260,
        video: false,
        aceitaTemporada: true,
        matchScore: 60,
        description: 'Unidade de 2 quartos no Residencial Jardins do Cerrado, com 68 m² de área privativa e 2 vagas de garagem.',
        amenities: ['Piscina', 'Academia', 'Salão de festas'],
        empreendimentoId: 'jardins-do-cerrado'
      },
      {
        id: 'jardins-do-cerrado-3q',
        tipoUnidade: 'apartamento',
        finalidade: 'venda',
        deliveryDate: '2027-12',
        price: 'R$ 1.020.000',
        location: 'Jardim Goiás, Goiânia — GO',
        beds: '3 qts',
        parking: '2 vg',
        area: '92 m²',
        height: 300,
        video: true,
        aceitaTemporada: false,
        matchScore: 88,
        description: 'Unidade de 3 quartos no Residencial Jardins do Cerrado, com 92 m² de área privativa e 2 vagas de garagem.',
        amenities: ['Piscina', 'Academia', 'Salão de festas', 'Playground'],
        empreendimentoId: 'jardins-do-cerrado'
      },
      {
        id: 'jardins-do-cerrado-3qs',
        tipoUnidade: 'apartamento_garden',
        finalidade: 'venda',
        deliveryDate: '2027-12',
        price: 'R$ 1.180.000',
        location: 'Jardim Goiás, Goiânia — GO',
        beds: '3 qts (1 suíte)',
        parking: '3 vg',
        area: '105 m²',
        height: 240,
        video: false,
        aceitaTemporada: false,
        matchScore: 74,
        description: 'Unidade de 3 quartos com suíte no Residencial Jardins do Cerrado, com 105 m² de área privativa e 3 vagas de garagem.',
        amenities: ['Piscina', 'Academia', 'Salão de festas', 'Playground', 'Bicicletário'],
        empreendimentoId: 'jardins-do-cerrado'
      }
    ]
  },
  {
    id: 'alto-marista-residence',
    name: 'Alto Marista Residence',
    location: 'Setor Marista, Goiânia — GO',
    deliveryDate: '2028-06',
    deliveryNote: 'Previsão de entrega: junho de 2028',
    description:
      'Torre única no Setor Marista com plantas de 1 a 3 quartos, a obra já em andamento. Rooftop com vista panorâmica e coworking para moradores.',
    tipo: 'vertical',
    pavimentos: 24,
    amenities: ['Rooftop', 'Coworking', 'Piscina', 'Espaço pet', 'Portaria 24h'],
    aceitaTemporada: true,
    heroHeight: 300,
    units: [
      {
        id: 'alto-marista-1q',
        tipoUnidade: 'studio',
        finalidade: 'venda',
        deliveryDate: '2028-06',
        price: 'R$ 520.000',
        location: 'Setor Marista, Goiânia — GO',
        beds: '1 qt',
        parking: '1 vg',
        area: '42 m²',
        height: 220,
        video: false,
        aceitaTemporada: true,
        matchScore: 50,
        description: 'Unidade de 1 quarto no Alto Marista Residence, com 42 m² de área privativa e 1 vaga de garagem.',
        amenities: ['Rooftop', 'Coworking', 'Piscina'],
        empreendimentoId: 'alto-marista-residence'
      },
      {
        id: 'alto-marista-2q',
        tipoUnidade: 'apartamento',
        finalidade: 'venda',
        deliveryDate: '2028-06',
        price: 'R$ 890.000',
        location: 'Setor Marista, Goiânia — GO',
        beds: '2 qts',
        parking: '2 vg',
        area: '75 m²',
        height: 320,
        video: true,
        aceitaTemporada: false,
        matchScore: 81,
        description: 'Unidade de 2 quartos no Alto Marista Residence, com 75 m² de área privativa e 2 vagas de garagem.',
        amenities: ['Rooftop', 'Coworking', 'Piscina', 'Espaço pet'],
        empreendimentoId: 'alto-marista-residence'
      }
    ]
  },
  {
    id: 'village-alto-do-cerrado',
    name: 'Village Alto do Cerrado',
    location: 'Região Sul de Goiânia — GO',
    deliveryDate: '2027-09',
    deliveryNote: 'Previsão de entrega: setembro de 2027',
    description:
      'Condomínio horizontal fechado com lotes e casas de 3 e 4 suítes, área verde preservada e portaria única. Loteamento com infraestrutura completa já em fase final de terraplanagem.',
    tipo: 'horizontal',
    areaTerreno: '48.000 m²',
    amenities: ['Portaria única', 'Área verde', 'Quadra poliesportiva', 'Espaço pet', 'Segurança 24h'],
    aceitaTemporada: false,
    heroHeight: 280,
    units: [
      {
        id: 'village-alto-3s',
        tipoUnidade: 'casa_condominio',
        finalidade: 'venda',
        deliveryDate: '2027-09',
        price: 'R$ 1.150.000',
        location: 'Região Sul de Goiânia — GO',
        beds: '3 qts (3 suítes)',
        parking: '3 vg',
        area: '180 m²',
        height: 280,
        video: false,
        aceitaTemporada: false,
        matchScore: 66,
        description: 'Casa de 3 suítes no Village Alto do Cerrado, com 180 m² de área construída e 3 vagas de garagem.',
        amenities: ['Portaria única', 'Área verde', 'Quadra poliesportiva'],
        empreendimentoId: 'village-alto-do-cerrado'
      },
      {
        id: 'village-alto-4s',
        tipoUnidade: 'sobrado',
        finalidade: 'venda',
        deliveryDate: '2027-09',
        price: 'R$ 1.480.000',
        location: 'Região Sul de Goiânia — GO',
        beds: '4 qts (4 suítes)',
        parking: '4 vg',
        area: '230 m²',
        height: 340,
        video: false,
        aceitaTemporada: false,
        matchScore: 58,
        description: 'Casa de 4 suítes no Village Alto do Cerrado, com 230 m² de área construída e 4 vagas de garagem.',
        amenities: ['Portaria única', 'Área verde', 'Quadra poliesportiva', 'Espaço pet'],
        empreendimentoId: 'village-alto-do-cerrado'
      }
    ]
  }
];

// Tudo que entra na aba "Comprar": imóveis avulsos + cada unidade de cada
// empreendimento, misturados — a separação por lançamento/usado é só a
// etiqueta calculada (ver lib/classification.ts), não uma categoria à parte.
const ALL_UNITS: PropertyDetail[] = DEVELOPMENTS.flatMap((d) => d.units);
const ALL_LISTINGS: (Property | PropertyDetail)[] = [...BASE_PROPERTIES, ...ALL_UNITS];

// Exportado pra gerar as páginas estáticas no build e o sitemap.xml — a lista
// "canônica" do catálogo de exemplo, sem os ids variantes do scroll infinito.
export const BASE_PROPERTIES_FOR_SITEMAP = ALL_LISTINGS;

// Simula um catálogo grande ciclando o dataset de exemplo com pequenas variações —
// substituir por paginação por cursor real da API (ver documento de arquitetura).
export function buildFeedPage(pageIndex: number): Property[] {
  return ALL_LISTINGS.map((p, i) => ({
    ...p,
    id: `${p.id}-c${pageIndex}`,
    height: 190 + ((p.height + pageIndex * 37 + i * 11) % 170)
  }));
}

export function getPropertyDetail(id: string): PropertyDetail | null {
  const baseId = id.replace(/-c\d+$/, '');
  const base = ALL_LISTINGS.find((p) => p.id === baseId);
  if (!base) return null;
  if (isPropertyDetail(base)) return { ...base, id };
  return { ...base, id, description: buildDescription(base), amenities: COMMON_AMENITIES };
}

export function getDevelopment(id: string): Development | null {
  return DEVELOPMENTS.find((d) => d.id === id) ?? null;
}

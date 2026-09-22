import type { PropertyDetail, Development } from './property-details';
import type { TipoUnidade } from './tipologias';

// Converte as linhas vindas do Postgres (snake_case, tipos nativos do banco)
// pros tipos que o resto do app já usa (camelCase, textos já formatados) —
// assim o resto do código (cards, páginas de detalhe) não precisa saber que
// existe um banco de dados por trás.

export type PropertyRow = {
  id: string;
  titulo: string | null;
  tipo_unidade: string;
  finalidade: 'venda' | 'aluguel';
  delivery_date: string; // formato AAAA-MM-DD vindo do driver
  price_value: string; // numeric vem como string do driver do Postgres
  price_period: 'unico' | 'mensal';
  location: string;
  quartos: number | null;
  vagas: number | null;
  banheiros: number | null;
  escaninhos: number | null;
  area: string | null;
  video: boolean;
  video_url: string | null;
  aceita_temporada: boolean;
  match_score: number;
  description: string;
  amenities: string[];
  empreendimento_id: string | null;
  corretor_email: string | null;
};

export type DevelopmentRow = {
  id: string;
  name: string;
  location: string;
  delivery_date: string;
  description: string;
  tipo: 'vertical' | 'horizontal';
  pavimentos: number | null;
  area_terreno: string | null;
  amenities: string[];
  aceita_temporada: boolean;
  hero_height: number;
  video_url: string | null;
  corretor_email: string | null;
};

function formatPrice(value: string, period: 'unico' | 'mensal'): string {
  const formatted = Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return period === 'mensal' ? `${formatted}/mês` : formatted;
}

function formatDeliveryDate(isoDate: string): string {
  return isoDate.slice(0, 7); // "AAAA-MM-DD" → "AAAA-MM"
}

// Altura do card no feed — puramente visual (masonry), não precisa vir do
// banco; deriva de forma estável do id pra não "pular" a cada nova busca.
function heightFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return 190 + (hash % 170);
}

export function mapPropertyRow(row: PropertyRow): PropertyDetail {
  return {
    id: row.id,
    titulo: row.titulo ?? undefined,
    tipoUnidade: row.tipo_unidade as TipoUnidade,
    finalidade: row.finalidade,
    deliveryDate: formatDeliveryDate(row.delivery_date),
    price: formatPrice(row.price_value, row.price_period),
    location: row.location,
    beds: row.quartos != null ? `${row.quartos} qts` : '—',
    parking: row.vagas != null ? `${row.vagas} vg` : '—',
    banheiros: row.banheiros != null ? `${row.banheiros} banheiros` : undefined,
    escaninhos: row.escaninhos != null ? `${row.escaninhos} escaninho(s)` : undefined,
    area: row.area != null ? `${Number(row.area)} m²` : '—',
    height: heightFromId(row.id),
    video: row.video,
    videoUrl: row.video_url ?? undefined,
    aceitaTemporada: row.aceita_temporada,
    matchScore: row.match_score,
    description: row.description,
    amenities: row.amenities ?? [],
    empreendimentoId: row.empreendimento_id ?? undefined,
    corretorEmail: row.corretor_email ?? undefined
  };
}

export function mapDevelopmentRow(row: DevelopmentRow, units: PropertyDetail[]): Development {
  const [year, month] = row.delivery_date.slice(0, 7).split('-');
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    deliveryDate: formatDeliveryDate(row.delivery_date),
    deliveryNote: `Previsão de entrega: ${MESES[Number(month) - 1] ?? month} de ${year}`,
    description: row.description,
    tipo: row.tipo,
    pavimentos: row.pavimentos ?? undefined,
    areaTerreno: row.area_terreno ?? undefined,
    amenities: row.amenities ?? [],
    aceitaTemporada: row.aceita_temporada,
    heroHeight: row.hero_height,
    videoUrl: row.video_url ?? undefined,
    corretorEmail: row.corretor_email ?? undefined,
    units
  };
}

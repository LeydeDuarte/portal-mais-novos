import { cleanPhotoUrl } from './r2-url';
import { formatTitulo } from './text';
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
  delivery_date: string | Date; // o driver às vezes devolve Date, às vezes string
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
  photos?: unknown;
  plantas?: unknown;
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  condominio?: string | null;
  is_tipologia?: boolean;
  video_vertical?: boolean;
};

export type DevelopmentRow = {
  id: string;
  name: string;
  location: string;
  delivery_date: string | Date | null; // vazio em condomínio ainda em rascunho
  description: string;
  tipo: 'vertical' | 'horizontal';
  pavimentos: number | null;
  area_terreno: string | null;
  amenities: string[];
  aceita_temporada: boolean;
  hero_height: number;
  video_url: string | null;
  corretor_email: string | null;
  photos?: unknown;
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  tipos_unidade?: unknown;
  quartos_opcoes?: unknown;
  status?: string;
  video_vertical?: boolean;
};

// jsonb pode chegar como array ou (em casos raros) como texto — normaliza
export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0).map(cleanPhotoUrl);
  if (typeof value === 'string') {
    try {
      return toStringArray(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

function toNumberArray(value: unknown): number[] {
  const arr = Array.isArray(value) ? value : toStringArray(value);
  return arr.map(Number).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
}

function formatPrice(value: string, period: 'unico' | 'mensal'): string {
  const formatted = Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return period === 'mensal' ? `${formatted}/mês` : formatted;
}

// O driver do Postgres às vezes devolve colunas "date" como objeto Date, não
// como texto — isso normaliza os dois casos antes de qualquer .slice()/.split().
function toISODateString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function formatDeliveryDate(value: string | Date): string {
  return toISODateString(value).slice(0, 7); // "AAAA-MM-DD" → "AAAA-MM"
}

// Altura do card no feed — puramente visual (masonry), não precisa vir do
// banco; deriva de forma estável do id pra não "pular" a cada nova busca.
export function heightFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return 190 + (hash % 170);
}

export function mapPropertyRow(row: PropertyRow): PropertyDetail {
  return {
    id: row.id,
    titulo: row.titulo ? formatTitulo(row.titulo) : undefined,
    tipoUnidade: row.tipo_unidade as TipoUnidade,
    finalidade: row.finalidade,
    deliveryDate: formatDeliveryDate(row.delivery_date),
    price: formatPrice(row.price_value, row.price_period),
    location: row.location,
    beds: row.quartos != null ? `${row.quartos} qts` : '—',
    parking: row.vagas != null ? `${row.vagas} vg` : '—',
    banheiros: row.banheiros != null ? `${row.banheiros} banheiros` : undefined,
    escaninhos: row.escaninhos != null ? `${row.escaninhos} escaninho(s)` : undefined,
    area: row.area != null ? `${Number(row.area).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²` : '—',
    areaValue: row.area != null ? Number(row.area) : undefined,
    priceValue: Number(row.price_value) || undefined,
    height: heightFromId(row.id),
    video: row.video,
    videoUrl: row.video_url ?? undefined,
    aceitaTemporada: row.aceita_temporada,
    matchScore: row.match_score,
    description: row.description,
    amenities: row.amenities ?? [],
    empreendimentoId: row.empreendimento_id ?? undefined,
    corretorEmail: row.corretor_email ?? undefined,
    photos: toStringArray(row.photos),
    plantas: toStringArray(row.plantas),
    condominio: row.condominio ? formatTitulo(row.condominio) : undefined,
    bairro: row.bairro ?? undefined,
    cidade: row.cidade ?? undefined,
    isTipologia: !!row.is_tipologia,
    videoVertical: !!row.video_vertical
  };
}

export function mapDevelopmentRow(row: DevelopmentRow, units: PropertyDetail[]): Development {
  const deliveryDateFormatted = row.delivery_date ? formatDeliveryDate(row.delivery_date) : '';
  const [year, month] = deliveryDateFormatted.split('-');
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return {
    id: row.id,
    name: formatTitulo(row.name),
    location: row.location,
    deliveryDate: deliveryDateFormatted,
    deliveryNote: deliveryDateFormatted
      ? `${new Date(`${deliveryDateFormatted}-01T00:00:00`) > new Date() ? 'Previsão de entrega' : 'Entregue em'}${
          new Date(`${deliveryDateFormatted}-01T00:00:00`) > new Date() ? ':' : ''
        } ${MESES[Number(month) - 1] ?? month} de ${year}`
      : 'Data de entrega a confirmar',
    description: row.description,
    tipo: row.tipo,
    pavimentos: row.pavimentos ?? undefined,
    areaTerreno: row.area_terreno ?? undefined,
    amenities: row.amenities ?? [],
    aceitaTemporada: row.aceita_temporada,
    heroHeight: row.hero_height,
    videoUrl: row.video_url ?? undefined,
    corretorEmail: row.corretor_email ?? undefined,
    photos: toStringArray(row.photos),
    tiposUnidade: toStringArray(row.tipos_unidade) as TipoUnidade[],
    quartosOpcoes: toNumberArray(row.quartos_opcoes),
    bairro: row.bairro ?? undefined,
    cidade: row.cidade ?? undefined,
    cep: row.cep ?? undefined,
    status: row.status === 'rascunho' ? 'rascunho' : 'publicado',
    videoVertical: !!row.video_vertical,
    units
  };
}

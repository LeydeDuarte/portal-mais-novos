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
  delivery_date: string | Date | null; // o driver às vezes devolve Date, às vezes string
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
  aceita_temporada: boolean | null;
  match_score: number;
  description: string;
  amenities: string[];
  empreendimento_id: string | null;
  corretor_email: string | null;
  photos?: unknown;
  plantas?: unknown;
  visibilidade?: string;
  jetimob_codigo?: string | null;
  vendido_em?: string | Date | null;
  visualizacoes?: number | null;
  capa_mini?: string | null;
  capa_mini_de?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  slug?: string | null;
  area_lote?: string | number | null;
  area_total?: string | number | null;
  destaque_tamanho?: number | null;
  valor_condominio?: string | number | null;
  iptu_mensal?: string | number | null;
  complemento?: string | null;
  unidade?: string | null;
  quadra?: string | null;
  lote?: string | null;
  obs_interna?: string | null;
  photos_internas?: unknown;
  compartilhamentos?: number | null;
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
  disponibilidade?: unknown;
  disponiveis?: number | null;
  tabela_referencia?: string | Date | null;
  vendido_100?: boolean | null;
  obra_paralisada?: boolean | null;
  obra_paralisada_em?: string | Date | null;
  obra_retomada_em?: string | Date | null;
  hero_height: number;
  video_url: string | null;
  corretor_email: string | null;
  photos?: unknown;
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  slug?: string | null;
  tipos_unidade?: unknown;
  quartos_opcoes?: unknown;
  status?: string;
  visualizacoes?: number | null;
  capa_mini?: string | null;
  capa_mini_de?: string | null;
  video_vertical?: boolean;
  lat?: number | null;
  lng?: number | null;
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
  if (!Number(value)) return 'Valor sob consulta';
  const formatted = Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return period === 'mensal' ? `${formatted}/mês` : formatted;
}

// O driver do Postgres às vezes devolve colunas "date" como objeto Date, não
// como texto — isso normaliza os dois casos antes de qualquer .slice()/.split().
function toISODateString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function formatDeliveryDate(value: string | Date | null): string {
  if (!value) return ''; // sem ano de entrega → exibe "----"
  return toISODateString(value).slice(0, 7); // "AAAA-MM-DD" → "AAAA-MM"
}

// Altura do card no feed — puramente visual (masonry), não precisa vir do
// banco; deriva de forma estável do id pra não "pular" a cada nova busca.
export function heightFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return 190 + (hash % 170);
}

// Miniatura só vale se foi feita da capa ATUAL
// Endereços antigos gravados como "Bairro, Cidade — GO" aparecem como "Bairro, Cidade/GO"
export function semTravessao(t?: string | null): string {
  return String(t ?? '').replace(/\s*—\s*/g, '/');
}

export function miniValida(row: { photos?: unknown; capa_mini?: string | null; capa_mini_de?: string | null }): string | undefined {
  const capa = toStringArray(row.photos)[0];
  return row.capa_mini && capa && row.capa_mini_de === capa ? row.capa_mini : undefined;
}

export function mapPropertyRow(row: PropertyRow): PropertyDetail {
  return {
    id: row.id,
    titulo: row.titulo ? formatTitulo(row.titulo) : undefined,
    tipoUnidade: row.tipo_unidade as TipoUnidade,
    finalidade: row.finalidade,
    deliveryDate: formatDeliveryDate(row.delivery_date),
    price: formatPrice(row.price_value, row.price_period),
    location: semTravessao(row.location),
    beds: row.quartos != null ? `${row.quartos} qts` : '-',
    parking: row.vagas != null ? `${row.vagas} vg` : '-',
    banheiros: row.banheiros != null ? `${row.banheiros} banheiros` : undefined,
    escaninhos: row.escaninhos != null ? `${row.escaninhos} escaninho(s)` : undefined,
    area: row.area != null ? `${Number(row.area).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²` : '-',
    areaValue: row.area != null ? Number(row.area) : undefined,
    areaTotal: row.area_total != null ? Number(row.area_total) : undefined,
    destaqueTamanho: row.destaque_tamanho === 3 ? 3 : 2,
    areaLote: row.area_lote != null ? Number(row.area_lote) : undefined,
    valorCondominio: row.valor_condominio != null ? Number(row.valor_condominio) : undefined,
    iptuMensal: row.iptu_mensal != null ? Number(row.iptu_mensal) : undefined,
    priceValue: Number(row.price_value) || undefined,
    height: heightFromId(row.id),
    video: row.video,
    videoUrl: row.video_url ?? undefined,
    aceitaTemporada: row.aceita_temporada,
    matchScore: row.match_score,
    description: row.description,
    amenities: row.amenities ?? [],
    empreendimentoId: row.empreendimento_id ?? undefined,
    photos: toStringArray(row.photos),
    plantas: toStringArray(row.plantas),
    visibilidade: row.visibilidade === 'privado' ? 'privado' : 'publico',
    codigo: row.jetimob_codigo ?? undefined,
    visualizacoes: Number(row.visualizacoes) || 0,
    capaMini: miniValida(row),
    vendidoEm: row.vendido_em ? new Date(row.vendido_em).toISOString() : undefined,
    condominio: row.condominio ? formatTitulo(row.condominio) : undefined,
    bairro: row.bairro ?? undefined,
    cidade: row.cidade ?? undefined,
    uf: row.uf ?? undefined,
    slug: row.slug ?? undefined,
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
    location: semTravessao(row.location),
    deliveryDate: deliveryDateFormatted,
    deliveryNote: deliveryDateFormatted
      ? `${new Date(`${deliveryDateFormatted}-01T00:00:00`) > new Date() ? 'Previsão de entrega' : row.tipo === 'horizontal' ? 'Condomínio entregue em' : 'Entregue em'}${
          new Date(`${deliveryDateFormatted}-01T00:00:00`) > new Date() ? ':' : ''
        } ${MESES[Number(month) - 1] ?? month} de ${year}`
      : 'Entrega: --/----',
    description: row.description,
    tipo: row.tipo,
    pavimentos: row.pavimentos ?? undefined,
    areaTerreno: row.area_terreno ?? undefined,
    amenities: row.amenities ?? [],
    aceitaTemporada: row.aceita_temporada,
    disponibilidade: Array.isArray(row.disponibilidade) ? (row.disponibilidade as Development['disponibilidade']) : null,
    disponiveis: row.disponiveis ?? null,
    vendido100: !!row.vendido_100,
    obraParalisada: !!row.obra_paralisada,
    obraParalisadaEm: row.obra_paralisada_em ? new Date(row.obra_paralisada_em).toISOString().slice(0, 7) : null,
    obraRetomadaEm: row.obra_retomada_em ? new Date(row.obra_retomada_em).toISOString().slice(0, 10) : null,
    tabelaReferencia: row.tabela_referencia ? new Date(row.tabela_referencia).toISOString().slice(0, 7) : null,
    heroHeight: row.hero_height,
    videoUrl: row.video_url ?? undefined,
    photos: toStringArray(row.photos),
    tiposUnidade: toStringArray(row.tipos_unidade) as TipoUnidade[],
    quartosOpcoes: toNumberArray(row.quartos_opcoes),
    bairro: row.bairro ?? undefined,
    cidade: row.cidade ?? undefined,
    uf: row.uf ?? undefined,
    slug: row.slug ?? undefined,
    cep: row.cep ?? undefined,
    status: row.status === 'rascunho' ? 'rascunho' : 'publicado',
    videoVertical: !!row.video_vertical,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    units
  };
}

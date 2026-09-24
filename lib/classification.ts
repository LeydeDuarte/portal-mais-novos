// Regra de negócio: nenhum imóvel ou empreendimento tem etiqueta fixa cadastrada
// manualmente. Tudo é CALCULADO a partir da data de entrega ("deliveryDate",
// formato "AAAA-MM"), comparando com a data atual:
//
// - Entrega no futuro                         → "Lançamento"
// - Entregue há até 36 meses (3 anos)         → "Novo"
// - Entregue de 3 a 6 anos atrás              → "Seminovo"
// - Entregue há mais de 6 anos                → "Usado"
//
// Como a comparação é sempre contra hoje, um imóvel migra sozinho de
// Lançamento → Seminovo → Usado conforme o tempo passa, sem precisar de
// nenhuma atualização manual nem campo extra.

export type StatusBucket = 'lancamento' | 'novo' | 'seminovo' | 'usado';

export const NOVO_LIMITE_ANOS = 3; // 36 meses depois da entrega
export const SEMINOVO_LIMITE_ANOS = 6; // + 3 anos como seminovo
const MS_POR_ANO = 1000 * 60 * 60 * 24 * 365.25;

function parseDeliveryDate(deliveryDate: string): Date {
  return new Date(`${deliveryDate}-01T00:00:00`);
}

export function isFutureDelivery(deliveryDate: string, today: Date = new Date()): boolean {
  return parseDeliveryDate(deliveryDate).getTime() > today.getTime();
}

function anosDesdeEntrega(deliveryDate: string, today: Date): number {
  return (today.getTime() - parseDeliveryDate(deliveryDate).getTime()) / MS_POR_ANO;
}

export function getStatusBucket(deliveryDate: string, today: Date = new Date()): StatusBucket {
  if (isFutureDelivery(deliveryDate, today)) return 'lancamento';
  const anos = anosDesdeEntrega(deliveryDate, today);
  if (anos <= NOVO_LIMITE_ANOS) return 'novo';
  return anos <= SEMINOVO_LIMITE_ANOS ? 'seminovo' : 'usado';
}

export function getDeliveryYear(deliveryDate: string): number {
  return Number(deliveryDate.slice(0, 4));
}

const BUCKET_LABEL: Record<StatusBucket, string> = {
  lancamento: 'Lançamento',
  novo: 'Novo',
  seminovo: 'Seminovo',
  usado: 'Usado'
};

// Cores por período — do mais recente/novo (azul, cor de destaque da marca)
// ao mais antigo (tom neutro), pra dar a leitura visual de "quão novo é" de relance.
const BUCKET_COLOR: Record<StatusBucket, { bg: string; text: string }> = {
  lancamento: { bg: '#257CFF', text: '#FFFFFF' },
  novo: { bg: '#1B5FCC', text: '#FFFFFF' },
  seminovo: { bg: '#5B6B7A', text: '#FFFFFF' },
  usado: { bg: 'rgba(20,22,26,0.72)', text: '#FFFFFF' }
};

export type StatusBadge = {
  bucket: StatusBucket;
  label: string;
  year: number;
  text: string; // "Lançamento · 2027"
  bg: string;
  color: string;
};

// Sem ano de entrega cadastrado (ex.: veio da Jetimob ou da planilha sem essa
// informação): no lugar do ano aparecem só tracinhos.
export const SEM_ANO = '----';
export function temEntrega(deliveryDate?: string | null): deliveryDate is string {
  return !!deliveryDate && /^\d{4}-\d{2}/.test(deliveryDate);
}

export function getStatusBadge(deliveryDate: string | null | undefined, today: Date = new Date()): StatusBadge {
  if (!temEntrega(deliveryDate)) {
    return { bucket: 'usado', label: '', year: 0, text: `Entrega · ${SEM_ANO}`, bg: 'rgba(20,22,26,0.72)', color: '#FFFFFF' };
  }
  const bucket = getStatusBucket(deliveryDate, today);
  const year = getDeliveryYear(deliveryDate);
  const { bg, text: color } = BUCKET_COLOR[bucket];
  return { bucket, label: BUCKET_LABEL[bucket], year, text: `${BUCKET_LABEL[bucket]} · ${year}`, bg, color };
}

// Condomínio HORIZONTAL (casas/lotes) já entregue: não recebe Novo/Seminovo/Usado —
// as casas têm idades diferentes da do condomínio. Mostra "Casas · desde 1999".
// Lançamento (entrega futura) continua como Lançamento.
export function getBadgeCondominio(deliveryDate: string | null | undefined, tipo?: string | null, today: Date = new Date()): StatusBadge {
  const b = getStatusBadge(deliveryDate, today);
  if (tipo !== 'horizontal' || b.bucket === 'lancamento') return b;
  return {
    ...b,
    bucket: 'usado',
    label: 'Condomínio de casas',
    text: temEntrega(deliveryDate) ? `Casas · desde ${getDeliveryYear(deliveryDate)}` : 'Condomínio de casas',
    bg: 'rgba(20,22,26,0.72)',
    color: '#FFFFFF'
  };
}

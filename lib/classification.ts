// Regra de negócio: nenhum imóvel ou empreendimento tem etiqueta fixa cadastrada
// manualmente. Tudo é CALCULADO a partir da data de entrega ("deliveryDate",
// formato "AAAA-MM"), comparando com a data atual:
//
// - Entrega no futuro                         → "Lançamento"
// - Entrega até 5 anos atrás                  → "Seminovo"
// - Entrega há mais de 5 anos                 → "Usado"
//
// Como a comparação é sempre contra hoje, um imóvel migra sozinho de
// Lançamento → Seminovo → Usado conforme o tempo passa, sem precisar de
// nenhuma atualização manual nem campo extra.

export type StatusBucket = 'lancamento' | 'seminovo' | 'usado';

const SEMINOVO_LIMITE_ANOS = 5;
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
  return anosDesdeEntrega(deliveryDate, today) <= SEMINOVO_LIMITE_ANOS ? 'seminovo' : 'usado';
}

export function getDeliveryYear(deliveryDate: string): number {
  return Number(deliveryDate.slice(0, 4));
}

const BUCKET_LABEL: Record<StatusBucket, string> = {
  lancamento: 'Lançamento',
  seminovo: 'Seminovo',
  usado: 'Usado'
};

// Cores por período — do mais recente/novo (azul, cor de destaque da marca)
// ao mais antigo (tom neutro), pra dar a leitura visual de "quão novo é" de relance.
const BUCKET_COLOR: Record<StatusBucket, { bg: string; text: string }> = {
  lancamento: { bg: '#257CFF', text: '#FFFFFF' },
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

export function getStatusBadge(deliveryDate: string, today: Date = new Date()): StatusBadge {
  const bucket = getStatusBucket(deliveryDate, today);
  const year = getDeliveryYear(deliveryDate);
  const { bg, text: color } = BUCKET_COLOR[bucket];
  return { bucket, label: BUCKET_LABEL[bucket], year, text: `${BUCKET_LABEL[bucket]} · ${year}`, bg, color };
}

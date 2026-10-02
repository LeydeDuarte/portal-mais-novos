// Regra de negócio: nenhum imóvel ou empreendimento tem etiqueta fixa cadastrada
// manualmente. A FASE é sempre CALCULADA pela data de entrega ("AAAA-MM"),
// comparando com hoje (definição da Leyde, set/2026):
//
//   Antes da entrega (meses que faltam):
//   - mais de 47 meses ............ Breve lançamento
//   - de 47 a 41 meses ............ Lançamento
//   - 40 meses até a entrega ...... Obras
//   Depois da entrega (meses desde a entrega):
//   - até 60 meses (5 anos) ....... Pronto novo
//   - de 60 a 180 meses ........... Seminovo   (novo + 120 meses)
//   - de 180 a 300 meses .......... Usado      (seminovo + 120 meses)
//   - mais de 300 meses (25 anos) . Antigo
//
// Vale igual para casas em condomínio horizontal: a casa usa a data de entrega
// (habite-se) dela mesma, não a do condomínio.
// As chaves 'lancamento', 'novo', 'seminovo' e 'usado' foram mantidas (links e
// filtros antigos continuam valendo); 'novo' é exibido como "Pronto novo".

export type StatusBucket = 'breve_lancamento' | 'lancamento' | 'obras' | 'novo' | 'seminovo' | 'usado' | 'antigo';

export const FASES: StatusBucket[] = ['breve_lancamento', 'lancamento', 'obras', 'novo', 'seminovo', 'usado', 'antigo'];
/** Fases antes da entrega (empreendimento ainda não entregue) */
export const FASES_FUTURAS: StatusBucket[] = ['breve_lancamento', 'lancamento', 'obras'];
/** Fases em que o empreendimento precisa ter construtora/incorporadora na Concepção */
export const FASES_EXIGEM_CONCEPCAO: StatusBucket[] = ['breve_lancamento', 'lancamento', 'obras', 'novo', 'seminovo'];

// Limites em meses (usados também nas consultas ao banco)
export const MESES = { breveLancamento: 47, lancamento: 41, novo: 60, seminovo: 180, usado: 300 };

function parseDeliveryDate(deliveryDate: string): Date {
  return new Date(`${deliveryDate.slice(0, 7)}-01T00:00:00`);
}

export function isFutureDelivery(deliveryDate: string, today: Date = new Date()): boolean {
  return parseDeliveryDate(deliveryDate).getTime() > today.getTime();
}

/** Meses entre hoje e a entrega: positivo = falta; negativo = já entregue */
function mesesAteEntrega(deliveryDate: string, today: Date): number {
  const d = parseDeliveryDate(deliveryDate);
  return (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth());
}

export function getStatusBucket(deliveryDate: string, today: Date = new Date()): StatusBucket {
  const m = mesesAteEntrega(deliveryDate, today);
  if (isFutureDelivery(deliveryDate, today)) {
    if (m > MESES.breveLancamento) return 'breve_lancamento';
    if (m >= MESES.lancamento) return 'lancamento';
    return 'obras';
  }
  const idade = -m;
  if (idade <= MESES.novo) return 'novo';
  if (idade <= MESES.seminovo) return 'seminovo';
  if (idade <= MESES.usado) return 'usado';
  return 'antigo';
}

export const ehFutura = (b: StatusBucket) => FASES_FUTURAS.includes(b);

export function getDeliveryYear(deliveryDate: string): number {
  return Number(deliveryDate.slice(0, 4));
}

export const BUCKET_LABEL: Record<StatusBucket, string> = {
  breve_lancamento: 'Breve lançamento',
  lancamento: 'Lançamento',
  obras: 'Obras',
  novo: 'Pronto novo',
  seminovo: 'Seminovo',
  usado: 'Usado',
  antigo: 'Antigo'
};

// Cores por período — do mais recente/novo (azul, cor de destaque da marca)
// ao mais antigo (tom neutro), pra dar a leitura visual de "quão novo é" de relance.
const BUCKET_COLOR: Record<StatusBucket, { bg: string; text: string }> = {
  breve_lancamento: { bg: '#6A3CFF', text: '#FFFFFF' },
  lancamento: { bg: '#257CFF', text: '#FFFFFF' },
  obras: { bg: '#E08A00', text: '#FFFFFF' },
  novo: { bg: '#1B5FCC', text: '#FFFFFF' },
  seminovo: { bg: '#5B6B7A', text: '#FFFFFF' },
  usado: { bg: 'rgba(20,22,26,0.72)', text: '#FFFFFF' },
  antigo: { bg: 'rgba(20,22,26,0.55)', text: '#FFFFFF' }
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
// Antes da entrega (breve lançamento, lançamento, obras) mostra a fase normal.
export function getBadgeCondominio(deliveryDate: string | null | undefined, tipo?: string | null, today: Date = new Date()): StatusBadge {
  const b = getStatusBadge(deliveryDate, today);
  if (tipo !== 'horizontal' || ehFutura(b.bucket)) return b;
  return {
    ...b,
    bucket: 'usado',
    label: 'Condomínio de casas',
    text: temEntrega(deliveryDate) ? `Casas · desde ${getDeliveryYear(deliveryDate)}` : 'Condomínio de casas',
    bg: 'rgba(20,22,26,0.72)',
    color: '#FFFFFF'
  };
}

/** Lançamento, em obras ou novo (até 36 meses da entrega): onde faz sentido escolher unidade pelo sol */
export function lancamentoOuNovo(deliveryDate?: string | null, today: Date = new Date()): boolean {
  if (!temEntrega(deliveryDate)) return false;
  const f = getStatusBucket(deliveryDate as string, today);
  return FASES_FUTURAS.includes(f) || f === 'novo';
}

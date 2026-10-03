// Contas da avaliação interna (Painel → Avaliação de imóveis). Mesmo método do avaliador
// do site (comparativo direto, ABNT NBR 14653-2): homogeneização por oferta, área, quartos,
// vagas e idade; saneamento a ±35% da mediana; média ponderada; intervalo de 80%.
// Arquivo sem banco e sem 'use server': serve no navegador e no servidor.

export const GRUPO_TIPO: Record<string, string> = {
  studio: 'vertical', flat: 'vertical', loft: 'vertical', apartamento: 'vertical', apartamento_garden: 'vertical',
  apartamento_duplex: 'vertical', apartamento_triplex: 'vertical', cobertura: 'vertical', cobertura_duplex: 'vertical', penthouse: 'vertical',
  casa: 'casa', casa_condominio: 'casa', sobrado: 'casa',
  chacara_sitio_fazenda: 'terra', terreno_lote: 'terra',
  sala_comercial: 'comercial', loja_ponto_comercial: 'comercial', galpao: 'comercial', predio_comercial: 'comercial'
};
export const TIPOS_AVALIACAO: [string, string][] = [
  ['apartamento', 'Apartamento'],
  ['cobertura', 'Cobertura'],
  ['studio', 'Studio / Flat'],
  ['casa_condominio', 'Casa em condomínio'],
  ['casa', 'Casa'],
  ['sobrado', 'Sobrado'],
  ['terreno_lote', 'Terreno / Lote'],
  ['sala_comercial', 'Sala comercial']
];

export type ImovelAvaliacao = {
  developmentId?: string | null;
  condominio?: string | null;
  horizontal?: boolean;
  bairro: string;
  cidade: string;
  tipo: string;
  area: number;
  quartos?: number | null;
  suites?: number | null;
  vagas?: number | null;
  ano?: number | null;
  unidade?: string | null;
  observacao?: string | null;
  /** margem de metragem das amostras, em % (20 = de 20% a menos a 20% a mais); padrão 20 */
  margemPct?: number | null;
  /** margem de idade das amostras, em anos (5 = entregues até 5 anos antes ou depois); 0 = qualquer idade */
  margemIdade?: number | null;
  /** raio de busca em km (prédio: condomínio + prédios a até X km); padrão 1 */
  raioKm?: number | null;
  /** validade dos anúncios de portais, em meses (visto há até X meses, mesmo que já excluído); padrão 6 */
  validadeMeses?: number | null;
  /** desconto de negociação estimado sobre os anúncios, em % (padrão 10) */
  descontoPct?: number | null;
  /** condomínio horizontal: avaliar a casa com o lote, ou só o lote */
  objeto?: 'casa_lote' | 'lote' | null;
  /** área do lote (m²) do imóvel avaliado (casa com lote) */
  areaLote?: number | null;
};

export const DESCONTO_PADRAO = 10;
export const descontoDe = (e: Pick<ImovelAvaliacao, 'descontoPct'>) => (e.descontoPct == null || Number.isNaN(Number(e.descontoPct)) ? DESCONTO_PADRAO : Math.min(50, Math.max(0, Number(e.descontoPct))));

export const VALIDADE_PADRAO_MESES = 6;

export const RAIO_PADRAO_KM = 1;
export const raioDe = (e: Pick<ImovelAvaliacao, 'raioKm'>) => Math.min(20, Math.max(0.1, Number(e.raioKm) || RAIO_PADRAO_KM));

export const MARGEM_IDADE_PADRAO = 5;
/** Por que uma amostra fica fora sozinha (o profissional pode incluir de volta, menos 'metragem'):
 *  metragem fora da margem, idade fora da margem ou idade não informada. */
export function motivoFora(e: Pick<ImovelAvaliacao, 'area' | 'margemPct' | 'ano' | 'margemIdade' | 'raioKm'>, a: Pick<AmostraAvaliacao, 'area' | 'ano' | 'origem' | 'distKm' | 'mesmoCondominio'>): 'metragem' | 'idade' | 'semIdade' | 'raio' | null {
  if (a.origem === 'manual') return null; // amostra digitada à mão: quem decide é o profissional
  const f = faixaMetragem(e);
  if (a.area < f.min || a.area > f.max) return 'metragem';
  // mais longe que o raio escolhido (só quando a distância é conhecida)
  if (!a.mesmoCondominio && a.distKm != null && a.distKm > raioDe(e) + 0.001) return 'raio';
  const m = e.margemIdade == null ? MARGEM_IDADE_PADRAO : Number(e.margemIdade);
  if (e.ano && e.ano > 1950 && m > 0) {
    if (!a.ano) return 'semIdade';
    if (Math.abs(a.ano - e.ano) > m) return 'idade';
  }
  return null;
}

export const MARGEM_PADRAO = 20;
/** faixa de metragem aceita para as amostras */
export function faixaMetragem(e: Pick<ImovelAvaliacao, 'area' | 'margemPct'>): { min: number; max: number; pct: number } {
  const pct = Math.min(90, Math.max(1, Number(e.margemPct) || MARGEM_PADRAO));
  const a = Number(e.area) || 0;
  return { min: a * (1 - pct / 100), max: a * (1 + pct / 100), pct };
}

/** origem: 'nosso' (anúncio do portal), 'vendido' (histórico com valor de venda), 'portal' (internet), 'manual' */
export type AmostraAvaliacao = {
  id: string;
  origem: 'nosso' | 'vendido' | 'portal' | 'manual';
  portal?: string | null;
  /** quem anuncia (imobiliária ou corretor); nos nossos anúncios, Mais Novos Imóveis */
  anunciante?: string | null;
  /** anúncio de portal: quando foi visto pela última vez (AAAA-MM-DD) */
  vistoEm?: string | null;
  /** situação do anúncio: vendido ou excluído (retirado do ar), com a data (AAAA-MM-DD) */
  situacao?: 'ativo' | 'vendido' | 'excluido' | null;
  situacaoEm?: string | null;
  /** fatos extraídos da descrição (nunca o texto): código de referência do anunciante, andar e características curtas */
  codigoRef?: string | null;
  andar?: number | null;
  caracteristicas?: string[] | null;
  url?: string | null;
  titulo?: string | null;
  condominio?: string | null;
  bairro?: string | null;
  area: number;
  /** área do lote (casas em condomínio) */
  areaLote?: number | null;
  quartos?: number | null;
  vagas?: number | null;
  ano?: number | null;
  preco: number;
  distKm?: number | null;
  mesmoCondominio?: boolean;
  usar: boolean; // o corretor pode tirar antes do cálculo
  /** fora da margem de metragem escolhida (sai do cálculo; volta se a margem aumentar) */
  foraMargem?: boolean;
  /** motivo de ter saído sozinha do cálculo (metragem, idade ou idade não informada) */
  fora?: 'metragem' | 'idade' | 'semIdade' | 'raio' | 'repetido' | null;
  /** repetido: o mesmo imóvel em outros sites (na que fica) ou onde ficou (na que sai) */
  tambemEm?: string[];
  repetidoDe?: string | null;
  // preenchidos no cálculo
  m2?: number;
  m2Homog?: number; // com o desconto de negociação
  m2HomogBruto?: number; // sem o desconto (pelo preço anunciado)
  peso?: number;
  descartada?: boolean;
};

export type ValorFaixa = { valor: number; minimo: number; maximo: number; m2: number };
/** valor/faixa = estimativa de FECHAMENTO (com o desconto de negociação); semDesconto = pelos preços anunciados */
export type ResultadoAvaliacaoInterna = { valor: number; minimo: number; maximo: number; m2: number; n: number; descartadas: number; grau: string; amplitudePct: number; descontoPct?: number; semDesconto?: ValorFaixa };

const T80: Record<number, number> = { 1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476, 6: 1.44, 7: 1.415, 8: 1.397, 9: 1.383, 10: 1.372, 12: 1.356, 15: 1.341, 20: 1.325, 30: 1.31 };
const t80 = (gl: number) => {
  for (const k of Object.keys(T80).map(Number).sort((a, b) => a - b)) if (gl <= k) return T80[k];
  return 1.282;
};

export function calcularAvaliacaoInterna(
  e: ImovelAvaliacao,
  todas: AmostraAvaliacao[]
): { ok: true; resultado: ResultadoAvaliacaoInterna; amostras: AmostraAvaliacao[] } | { ok: false; erro: string; amostras: AmostraAvaliacao[] } {
  const area = Number(e.area);
  if (!(area >= 15 && area <= 100000)) return { ok: false, erro: 'Informe a área do imóvel avaliado.', amostras: todas };
  const anoAval = e.ano && e.ano > 1950 ? e.ano : null;
  const usadas = todas
    .filter((a) => a.usar && a.area > 0 && a.preco > 0)
    .map((a) => {
      const m2 = a.preco / a.area;
      // anúncio é preço pedido: desconto de negociação escolhido por quem avalia (vendido = preço real)
      const fOferta = a.origem === 'vendido' ? 1 : 1 - descontoDe(e) / 100;
      const fArea = Math.pow(a.area / area, 0.125);
      const fQuartos = e.quartos && a.quartos ? 1 + 0.03 * (e.quartos - a.quartos) : 1;
      const fVagas = e.vagas != null && a.vagas != null ? 1 + 0.04 * (e.vagas - a.vagas) : 1;
      const fIdade = anoAval && a.ano ? Math.min(1.2, Math.max(0.8, 1 + 0.01 * (anoAval - a.ano))) : 1;
      const fLote =
        e.objeto !== 'lote' && e.areaLote && a.areaLote ? Math.min(1.25, Math.max(0.8, Math.pow(Number(e.areaLote) / a.areaLote, 0.25))) : 1;
      const m2HomogBruto = m2 * fArea * fQuartos * fVagas * fIdade * fLote;
      const m2Homog = m2HomogBruto * fOferta;
      const peso = (a.mesmoCondominio ? 2 : 1) * (1 / (1 + (a.distKm ?? 0.8))) * (1 / (1 + Math.abs(a.area - area) / area));
      return { ...a, m2, m2Homog, m2HomogBruto, peso, descartada: false };
    });
  if (usadas.length < 3) return { ok: false, erro: 'São precisas pelo menos 3 amostras para a avaliação. Busque nos portais ou acrescente amostras.', amostras: todas };
  const ord = usadas.map((x) => x.m2Homog).sort((a, b) => a - b);
  const mediana = ord[Math.floor(ord.length / 2)];
  for (const x of usadas) x.descartada = x.m2Homog < mediana * 0.65 || x.m2Homog > mediana * 1.35;
  const boas = usadas.filter((x) => !x.descartada);
  const resto = todas.filter((a) => !usadas.some((u) => u.id === a.id));
  if (boas.length < 3) return { ok: false, erro: 'As amostras variam demais entre si. Confira os dados ou acrescente mais amostras.', amostras: [...usadas, ...resto] };
  const somaP = boas.reduce((s, x) => s + x.peso, 0);
  const media = boas.reduce((s, x) => s + x.m2Homog * x.peso, 0) / somaP;
  const n = boas.length;
  const desvio = Math.sqrt(boas.reduce((s, x) => s + Math.pow(x.m2Homog - media, 2), 0) / Math.max(1, n - 1));
  const meio = t80(n - 1) * (desvio / Math.sqrt(n));
  const valor = Math.round((media * area) / 1000) * 1000;
  const minimo = Math.round(((media - meio) * area) / 1000) * 1000;
  const maximo = Math.round(((media + meio) * area) / 1000) * 1000;
  const amplitudePct = Math.round(((maximo - minimo) / valor) * 1000) / 10;
  const grau = amplitudePct <= 30 ? 'III' : amplitudePct <= 40 ? 'II' : amplitudePct <= 50 ? 'I' : 'Fora da norma';
  // o mesmo cálculo pelos preços anunciados (sem o desconto), com as mesmas amostras
  const mediaB = boas.reduce((s, x) => s + (x.m2HomogBruto ?? x.m2Homog) * x.peso, 0) / somaP;
  const desvioB = Math.sqrt(boas.reduce((s, x) => s + Math.pow((x.m2HomogBruto ?? x.m2Homog) - mediaB, 2), 0) / Math.max(1, n - 1));
  const meioB = t80(n - 1) * (desvioB / Math.sqrt(n));
  const semDesconto = {
    valor: Math.round((mediaB * area) / 1000) * 1000,
    minimo: Math.round(((mediaB - meioB) * area) / 1000) * 1000,
    maximo: Math.round(((mediaB + meioB) * area) / 1000) * 1000,
    m2: Math.round(mediaB)
  };
  return {
    ok: true,
    resultado: { valor, minimo, maximo, m2: Math.round(media), n, descartadas: usadas.length - n, grau, amplitudePct, descontoPct: descontoDe(e), semDesconto },
    amostras: [...usadas, ...resto]
  };
}

/** Nome do site de origem do anúncio (fonte), para a tela e o relatório. */
export function nomeFonte(a: Pick<AmostraAvaliacao, 'origem' | 'portal' | 'url'>): string {
  const p = `${a.portal ?? ''} ${a.url ?? ''}`.toLowerCase();
  if (a.origem === 'nosso' || a.origem === 'vendido' || /maisnovosimoveis/.test(p)) return 'maisnovosimoveis.com';
  if (/zapimoveis|zap\.com/.test(p)) return 'ZAP Imóveis';
  if (/vivareal/.test(p)) return 'VivaReal';
  if (/olx/.test(p)) return 'OLX';
  if (/quintoandar/.test(p)) return 'QuintoAndar';
  if (/imovelweb/.test(p)) return 'Imovelweb';
  if (/chavesnamao/.test(p)) return 'Chaves na Mão';
  if (/62imoveis/.test(p)) return '62 Imóveis';
  if (/61imoveis/.test(p)) return '61 Imóveis';
  if (/dfimoveis/.test(p)) return 'DF Imóveis';
  if (a.portal) return a.portal.replace(/^www\./, '');
  return a.origem === 'manual' ? 'Informado pelo avaliador' : 'Portal';
}

/** Prioridade de um portal quando o mesmo imóvel aparece em mais de um (maior = prevalece). */
const prioridadePortal = (a: AmostraAvaliacao) => {
  const f = nomeFonte(a);
  // VivaReal tende a ter anúncios mais qualificados; depois ZAP; OLX e portais regionais; demais
  return f === 'maisnovosimoveis.com' ? 9 : f === 'VivaReal' ? 4 : f === 'ZAP Imóveis' ? 3 : f === 'OLX' || f === '62 Imóveis' || f === '61 Imóveis' || f === 'DF Imóveis' ? 2 : 1;
};
const semAcentoNome = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^(edificio|residencial|condominio)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** O mesmo imóvel em mais de um site (ou na nossa base e num portal): mesmo condomínio (ou bairro),
 *  metragem até 1,5% diferente, mesmos quartos e vagas (se informados) e preço até 3% diferente. */
export function mesmoImovel(a: AmostraAvaliacao, b: AmostraAvaliacao): boolean {
  const difPreco = Math.abs(a.preco - b.preco) / Math.max(a.preco, b.preco);
  // andares diferentes: imóveis diferentes
  if (a.andar != null && b.andar != null && a.andar !== b.andar) return false;
  // mesmo código de referência do anunciante: o mesmo imóvel (aceita reajuste de até 10% entre portais)
  const cod = (c?: string | null) => (c ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cod(a.codigoRef) && cod(a.codigoRef) === cod(b.codigoRef)) return difPreco <= 0.1 && Math.abs(a.area - b.area) / Math.max(a.area, b.area) <= 0.05;
  // características da descrição muito parecidas reforçam: aceita até 5% no preço
  const ca = new Set((a.caracteristicas ?? []).map(semAcentoNome).filter(Boolean));
  const cb = new Set((b.caracteristicas ?? []).map(semAcentoNome).filter(Boolean));
  const comuns = Array.from(ca).filter((x) => cb.has(x)).length;
  const parecidas = ca.size >= 3 && cb.size >= 3 && comuns / Math.min(ca.size, cb.size) >= 0.6;
  const tolPreco = parecidas ? 0.05 : 0.03;
  if (a.condominio && b.condominio) {
    if (semAcentoNome(a.condominio) !== semAcentoNome(b.condominio)) return false;
  } else if (semAcentoNome(a.bairro ?? '') !== semAcentoNome(b.bairro ?? '')) return false;
  if (Math.abs(a.area - b.area) / Math.max(a.area, b.area) > 0.015) return false;
  if (a.quartos != null && b.quartos != null && a.quartos !== b.quartos) return false;
  if (a.vagas != null && b.vagas != null && a.vagas !== b.vagas) return false;
  return difPreco <= tolPreco;
}

/** Quanto mais alto, mais relevante: nossa base, dados completos, visto mais recente, portal. */
function relevancia(a: AmostraAvaliacao): number {
  const recente = a.vistoEm ? Number(a.vistoEm.replace(/\D/g, '')) / 1e8 : 0; // 0,2026... (desempate)
  return (a.origem === 'nosso' || a.origem === 'vendido' ? 1000 : 0) + (a.condominio ? 40 : 0) + (a.ano ? 30 : 0) + prioridadePortal(a) * 5 + recente;
}

/** Marca os repetidos: de cada grupo do mesmo imóvel fica o mais relevante (com "também em ...");
 *  os outros saem do cálculo como 'repetido'. Amostra manual nunca é marcada. Não mexe em quem já
 *  está fora por outro motivo. */
export function marcarRepetidos(lista: AmostraAvaliacao[]): AmostraAvaliacao[] {
  const candidatas = lista.filter((a) => a.origem !== 'manual' && (!a.fora || a.fora === 'repetido'));
  const grupos: AmostraAvaliacao[][] = [];
  for (const a of candidatas.slice().sort((x, y) => relevancia(y) - relevancia(x))) {
    const g = grupos.find((gr) => mesmoImovel(gr[0], a));
    if (g) g.push(a);
    else grupos.push([a]);
  }
  const mudancas = new Map<string, Partial<AmostraAvaliacao>>();
  for (const g of grupos) {
    const [fica, ...saem] = g;
    const fontes = Array.from(new Set(saem.map((x) => nomeFonte(x)).filter((n) => n !== nomeFonte(fica))));
    mudancas.set(fica.id, { tambemEm: fontes, repetidoDe: null, ...(fica.fora === 'repetido' ? { fora: null, usar: true } : {}) });
    for (const x of saem) mudancas.set(x.id, { fora: 'repetido', usar: x.fora === 'repetido' ? x.usar : false, repetidoDe: nomeFonte(fica), tambemEm: [] });
  }
  return lista.map((a) => (mudancas.has(a.id) ? { ...a, ...mudancas.get(a.id) } : a));
}

export type ResumoFonte = { fonte: string; n: number; m2Anunciado: number; m2Ajustado: number };
/** Comparação entre os sites: amostras usadas no cálculo, por site de origem. */
export function resumoPorFonte(amostras: AmostraAvaliacao[]): ResumoFonte[] {
  const g = new Map<string, { n: number; a: number; j: number }>();
  for (const x of amostras) {
    if (!x.usar || x.descartada || !x.m2Homog) continue;
    const k = nomeFonte(x);
    const v = g.get(k) ?? { n: 0, a: 0, j: 0 };
    v.n++;
    v.a += x.preco / x.area;
    v.j += x.m2Homog;
    g.set(k, v);
  }
  return Array.from(g.entries())
    .map(([fonte, v]) => ({ fonte, n: v.n, m2Anunciado: Math.round(v.a / v.n), m2Ajustado: Math.round(v.j / v.n) }))
    .sort((a, b) => b.n - a.n);
}

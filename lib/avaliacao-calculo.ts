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
};

/** origem: 'nosso' (anúncio do portal), 'vendido' (histórico com valor de venda), 'portal' (internet), 'manual' */
export type AmostraAvaliacao = {
  id: string;
  origem: 'nosso' | 'vendido' | 'portal' | 'manual';
  portal?: string | null;
  url?: string | null;
  titulo?: string | null;
  condominio?: string | null;
  bairro?: string | null;
  area: number;
  quartos?: number | null;
  vagas?: number | null;
  ano?: number | null;
  preco: number;
  distKm?: number | null;
  mesmoCondominio?: boolean;
  usar: boolean; // o corretor pode tirar antes do cálculo
  // preenchidos no cálculo
  m2?: number;
  m2Homog?: number;
  peso?: number;
  descartada?: boolean;
};

export type ResultadoAvaliacaoInterna = { valor: number; minimo: number; maximo: number; m2: number; n: number; descartadas: number; grau: string; amplitudePct: number };

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
      const fOferta = a.origem === 'vendido' ? 1 : 0.9; // anúncio é preço pedido: desconto usual de negociação
      const fArea = Math.pow(a.area / area, 0.125);
      const fQuartos = e.quartos && a.quartos ? 1 + 0.03 * (e.quartos - a.quartos) : 1;
      const fVagas = e.vagas != null && a.vagas != null ? 1 + 0.04 * (e.vagas - a.vagas) : 1;
      const fIdade = anoAval && a.ano ? Math.min(1.2, Math.max(0.8, 1 + 0.01 * (anoAval - a.ano))) : 1;
      const m2Homog = m2 * fOferta * fArea * fQuartos * fVagas * fIdade;
      const peso = (a.mesmoCondominio ? 2 : 1) * (1 / (1 + (a.distKm ?? 0.8))) * (1 / (1 + Math.abs(a.area - area) / area));
      return { ...a, m2, m2Homog, peso, descartada: false };
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
  return {
    ok: true,
    resultado: { valor, minimo, maximo, m2: Math.round(media), n, descartadas: usadas.length - n, grau, amplitudePct },
    amostras: [...usadas, ...resto]
  };
}

// Custos da operação (módulo do servidor): consumo da IA (registrado a cada resposta),
// WhatsApp (Meta: relatório de preços da conta), cotação do dólar (Banco Central) e
// contas a pagar cadastradas à mão (Vercel, banco de dados, domínio etc.).
import { query } from './db';

export type PrecosIA = Record<string, { entrada: number; saida: number }>; // US$ por milhão de tokens
export const PRECOS_PADRAO: PrecosIA = {
  'claude-sonnet-5-5': { entrada: 3, saida: 15 },
  'claude-haiku-4-5-20251001': { entrada: 1, saida: 5 }
};

export async function lerPrecosIA(): Promise<PrecosIA> {
  const r = await query<{ valor: { precos?: PrecosIA } }>(`select valor from crm_config where chave = 'custos'`).catch(() => []);
  return { ...PRECOS_PADRAO, ...(r[0]?.valor?.precos ?? {}) };
}

/** grava o consumo de uma chamada à IA (usage devolvido pela API) */
export async function registrarUsoIA(
  modelo: string,
  usage: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; server_tool_use?: { web_search_requests?: number } } | undefined,
  contatoId: string | null
): Promise<void> {
  if (!usage) return;
  const precos = await lerPrecosIA();
  const p = precos[modelo] ?? { entrada: 3, saida: 15 };
  const e = usage.input_tokens ?? 0;
  const s = usage.output_tokens ?? 0;
  const ce = usage.cache_creation_input_tokens ?? 0;
  const cl = usage.cache_read_input_tokens ?? 0;
  // cache: escrita custa 1,25x a entrada; leitura, 0,1x
  const custo = (e * p.entrada + ce * p.entrada * 1.25 + cl * p.entrada * 0.1 + s * p.saida) / 1_000_000;
  // pesquisa na internet (ferramenta da IA): US$ 10 por mil pesquisas
  const pesquisas = usage.server_tool_use?.web_search_requests ?? 0;
  const custoTotal = custo + pesquisas * 0.01;
  await query(
    `insert into custos_uso (fornecedor, modelo, entrada, saida, cache_escrita, cache_leitura, custo_usd, contato_id) values ('anthropic', $1, $2, $3, $4, $5, $6, $7)`,
    [modelo, e, s, ce, cl, custoTotal, contatoId]
  ).catch(() => {});
}

/** dólar do dia (PTAX venda, Banco Central); reserva: 5,50 */
export async function cotacaoDolar(): Promise<{ valor: number; data: string | null; fonte: string }> {
  try {
    const r = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json', {
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(8000)
    });
    const j = (await r.json()) as { data: string; valor: string }[];
    const v = Number(String(j?.[0]?.valor ?? '').replace(',', '.'));
    if (v > 1) return { valor: v, data: j[0].data, fonte: 'PTAX do Banco Central' };
  } catch {
    /* sem cotação */
  }
  return { valor: 5.5, data: null, fonte: 'estimativa (sem cotação do dia)' };
}

/** custo do WhatsApp no mês pela própria Meta (relatório de preços da conta) */
export async function custoWhatsappMeta(inicio: Date, fim: Date): Promise<{ ok: boolean; usd: number; mensagens: number; erro?: string }> {
  const waba = process.env.WHATSAPP_WABA_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!waba || !token) return { ok: false, usd: 0, mensagens: 0, erro: 'WhatsApp não configurado' };
  const s = Math.floor(inicio.getTime() / 1000);
  const e = Math.floor(fim.getTime() / 1000);
  try {
    const url = `https://graph.facebook.com/v21.0/${waba}?fields=pricing_analytics.start(${s}).end(${e}).granularity(DAILY).metric_types(["COST","VOLUME"])`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000), next: { revalidate: 3600 } });
    const j = (await r.json()) as { pricing_analytics?: { data?: { data_points?: { cost?: number; volume?: number }[] }[] }; error?: { message?: string } };
    if (!r.ok) return { ok: false, usd: 0, mensagens: 0, erro: j.error?.message ?? `HTTP ${r.status}` };
    let usd = 0;
    let mensagens = 0;
    for (const d of j.pricing_analytics?.data ?? [])
      for (const p of d.data_points ?? []) {
        usd += Number(p.cost) || 0;
        mensagens += Number(p.volume) || 0;
      }
    return { ok: true, usd, mensagens };
  } catch (err) {
    return { ok: false, usd: 0, mensagens: 0, erro: err instanceof Error ? err.message : 'falha' };
  }
}

'use server';

// Painel → Custos da operação (só admin): IA, WhatsApp e contas a pagar, mês a mês, em reais.
import { query } from './db';
import { exigirEquipe } from './staff-auth';
import { cotacaoDolar, custoWhatsappMeta, lerPrecosIA, type PrecosIA } from './custos';

// Custos: só quem tem "acesso ao financeiro" (o administrador principal e quem ele liberar)
// ou o papel Financeiro.
async function soAdmin() {
  const s = await exigirEquipe();
  if (s.role === 'financeiro') return s;
  const r = await query<{ ok: boolean }>(`select acesso_financeiro as ok from staff_users where lower(email) = lower($1)`, [s.email]);
  if (!r[0]?.ok) throw new Error('Os custos são vistos só pelo administrador principal ou pelo financeiro.');
  return s;
}

export async function temAcessoFinanceiro(): Promise<boolean> {
  return soAdmin()
    .then(() => true)
    .catch(() => false);
}

export type Conta = {
  id: string;
  fornecedor: string;
  descricao: string | null;
  valor: number;
  moeda: 'BRL' | 'USD';
  recorrencia: 'mensal' | 'anual' | 'unica';
  vencimento: string | null;
  categoria: string | null;
  pagaNoMes: boolean;
  valorBrl: number;
};

export type PainelCustos = {
  mes: string;
  dolar: { valor: number; data: string | null; fonte: string };
  ia: { respostas: number; atendimentos: number; entrada: number; saida: number; cacheLeitura: number; usd: number; brl: number; porAtendimentoBrl: number | null };
  whatsapp: { meta: { ok: boolean; usd: number; brl: number; mensagens: number; erro?: string }; recebidas: number; enviadasIa: number; enviadasEquipe: number };
  contas: Conta[];
  totais: { iaBrl: number; whatsappBrl: number; contasBrl: number; total: number; aPagarBrl: number };
  historico: { mes: string; iaBrl: number; contasBrl: number }[];
  precos: PrecosIA;
};

const mesValido = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? m : new Date().toISOString().slice(0, 7));

export async function painelCustos(mesPedido?: string): Promise<PainelCustos> {
  await soAdmin();
  const mes = mesValido(mesPedido ?? '');
  const [ano, m] = mes.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, m - 1, 1, 3)); // meia-noite em Brasília
  const fim = new Date(Date.UTC(ano, m, 1, 3));
  const agora = new Date();
  const [dolar, ia, msgs, contasRows, pagas, hist, precos] = await Promise.all([
    cotacaoDolar(),
    query<{ n: string; contatos: string; e: string; s: string; cl: string; usd: string }>(
      `select count(*) n, count(distinct contato_id) contatos, coalesce(sum(entrada), 0) e, coalesce(sum(saida), 0) s, coalesce(sum(cache_leitura), 0) cl, coalesce(sum(custo_usd), 0) usd
         from custos_uso where fornecedor = 'anthropic' and criado_em >= $1 and criado_em < $2`,
      [inicio, fim]
    ),
    query<{ recebidas: string; ia: string; equipe: string }>(
      `select count(*) filter (where direcao = 'entrada') recebidas, count(*) filter (where direcao = 'saida' and autor = 'ia') ia,
              count(*) filter (where direcao = 'saida' and autor <> 'ia') equipe
         from crm_mensagens where criado_em >= $1 and criado_em < $2`,
      [inicio, fim]
    ),
    query<Record<string, unknown>>(`select * from contas_pagar order by fornecedor`),
    query<{ conta_id: string }>(`select conta_id from contas_pagas where mes = $1`, [mes]),
    query<{ mes: string; usd: string }>(
      `select to_char(criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM') mes, sum(custo_usd) usd from custos_uso
        where criado_em > now() - interval '7 months' group by 1 order by 1`
    ),
    lerPrecosIA()
  ]);
  const wa = await custoWhatsappMeta(inicio, fim < agora ? fim : agora);
  const brl = (usd: number) => Math.round(usd * dolar.valor * 100) / 100;
  const pagasSet = new Set(pagas.map((p) => p.conta_id));
  // contas do mês: mensais sempre; anuais no mês do vencimento; únicas no mês delas
  const doMes = (c: Record<string, unknown>) => {
    const venc = c.vencimento ? new Date(c.vencimento as string).toISOString().slice(0, 7) : null;
    if (c.recorrencia === 'mensal') return !c.criado_em || new Date(c.criado_em as string).toISOString().slice(0, 7) <= mes;
    if (c.recorrencia === 'anual') return !!venc && venc.slice(5) === mes.slice(5) && venc.slice(0, 4) <= mes.slice(0, 4);
    return venc === mes;
  };
  const contas: Conta[] = contasRows.filter(doMes).map((c) => {
    const valor = Number(c.valor) || 0;
    const moeda = c.moeda === 'USD' ? 'USD' : 'BRL';
    return {
      id: String(c.id),
      fornecedor: String(c.fornecedor),
      descricao: (c.descricao as string) ?? null,
      valor,
      moeda,
      recorrencia: (c.recorrencia as Conta['recorrencia']) ?? 'mensal',
      vencimento: c.vencimento ? new Date(c.vencimento as string).toISOString().slice(0, 10) : null,
      categoria: (c.categoria as string) ?? null,
      pagaNoMes: pagasSet.has(String(c.id)),
      valorBrl: moeda === 'USD' ? brl(valor) : valor
    };
  });
  const iaUsd = Number(ia[0]?.usd) || 0;
  const atend = Number(ia[0]?.contatos) || 0;
  const contasBrl = contas.reduce((a, c) => a + c.valorBrl, 0);
  const totalIa = brl(iaUsd);
  const totalWa = brl(wa.usd);
  // histórico: IA por mês + as contas mensais (aproximação: as cadastradas hoje)
  const mensais = contasRows.filter((c) => c.recorrencia === 'mensal').reduce((a, c) => a + (c.moeda === 'USD' ? brl(Number(c.valor)) : Number(c.valor)), 0);
  return {
    mes,
    dolar,
    ia: {
      respostas: Number(ia[0]?.n) || 0,
      atendimentos: atend,
      entrada: Number(ia[0]?.e) || 0,
      saida: Number(ia[0]?.s) || 0,
      cacheLeitura: Number(ia[0]?.cl) || 0,
      usd: iaUsd,
      brl: totalIa,
      porAtendimentoBrl: atend ? Math.round((totalIa / atend) * 100) / 100 : null
    },
    whatsapp: {
      meta: { ...wa, brl: totalWa },
      recebidas: Number(msgs[0]?.recebidas) || 0,
      enviadasIa: Number(msgs[0]?.ia) || 0,
      enviadasEquipe: Number(msgs[0]?.equipe) || 0
    },
    contas,
    totais: {
      iaBrl: totalIa,
      whatsappBrl: totalWa,
      contasBrl,
      total: Math.round((totalIa + totalWa + contasBrl) * 100) / 100,
      aPagarBrl: contas.filter((c) => !c.pagaNoMes).reduce((a, c) => a + c.valorBrl, 0)
    },
    historico: hist.map((h) => ({ mes: h.mes, iaBrl: brl(Number(h.usd) || 0), contasBrl: mensais })),
    precos
  };
}

export async function salvarConta(c: { id?: string; fornecedor: string; descricao?: string; valor: number; moeda: 'BRL' | 'USD'; recorrencia: 'mensal' | 'anual' | 'unica'; vencimento?: string | null; categoria?: string }): Promise<void> {
  await soAdmin();
  const forn = String(c.fornecedor ?? '').trim().slice(0, 80);
  const valor = Number(c.valor);
  if (!forn) throw new Error('Informe o fornecedor.');
  if (!(valor >= 0)) throw new Error('Informe o valor.');
  const vals = [
    forn,
    String(c.descricao ?? '').slice(0, 200) || null,
    valor,
    c.moeda === 'USD' ? 'USD' : 'BRL',
    ['mensal', 'anual', 'unica'].includes(c.recorrencia) ? c.recorrencia : 'mensal',
    c.vencimento && /^\d{4}-\d{2}-\d{2}$/.test(c.vencimento) ? c.vencimento : null,
    String(c.categoria ?? '').slice(0, 40) || null
  ];
  if (c.id) await query(`update contas_pagar set fornecedor = $2, descricao = $3, valor = $4, moeda = $5, recorrencia = $6, vencimento = $7, categoria = $8 where id = $1`, [c.id, ...vals]);
  else await query(`insert into contas_pagar (fornecedor, descricao, valor, moeda, recorrencia, vencimento, categoria) values ($1, $2, $3, $4, $5, $6, $7)`, vals);
}

export async function excluirConta(id: string): Promise<void> {
  await soAdmin();
  await query(`delete from contas_pagar where id = $1`, [id]);
}

export async function marcarContaPaga(id: string, mes: string, paga: boolean): Promise<void> {
  await soAdmin();
  const m = mesValido(mes);
  if (paga) await query(`insert into contas_pagas (conta_id, mes) values ($1, $2) on conflict do nothing`, [id, m]);
  else await query(`delete from contas_pagas where conta_id = $1 and mes = $2`, [id, m]);
}

export async function salvarPrecosIA(precos: PrecosIA): Promise<void> {
  await soAdmin();
  const limpo: PrecosIA = {};
  for (const [k, v] of Object.entries(precos ?? {})) {
    const e = Number(v?.entrada);
    const s = Number(v?.saida);
    if (k.trim() && e >= 0 && s >= 0) limpo[k.trim().slice(0, 60)] = { entrada: e, saida: s };
  }
  await query(
    `insert into crm_config (chave, valor) values ('custos', $1::jsonb) on conflict (chave) do update set valor = crm_config.valor || excluded.valor, atualizado_em = now()`,
    [JSON.stringify({ precos: limpo })]
  );
}

// Ferramentas da IA de atendimento ligadas às tabelas de vendas:
//  - tabela de vendas do empreendimento (a mais recente): unidades disponíveis POR METRAGEM (nunca o
//    número da unidade nem o andar) e a forma de pagamento da incorporadora;
//  - montar forma de pagamento: conforme a tabela ou personalizada, com a conta feita pelo sistema
//    (fecha sempre no valor total).
import { query } from './db';

type Parcela = { nome: string; qtd: number; inicio: string | null; pct: number };
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const brl0 = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pctTxt = (n: number) => `${String(Math.round(n * 100) / 100).replace('.', ',')}%`;
const mesExtenso = (aaaamm: string) => {
  const [a, m] = aaaamm.split('-').map(Number);
  return `${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][m - 1]} de ${a}`;
};

/** Acha o empreendimento pelo nome (aceita parte do nome). */
async function acharEmpreendimento(nome: string): Promise<{ id: string; name: string; entrega: string | null } | null> {
  const n = String(nome ?? '').trim();
  if (n.length < 3) return null;
  const r = await query<{ id: string; name: string; entrega: string | null }>(
    `select id, name, to_char(delivery_date, 'YYYY-MM') entrega from developments
      where translate(lower(name), 'áàâãéêíóôõúç', 'aaaaeeiooouc') like '%' || translate(lower($1), 'áàâãéêíóôõúç', 'aaaaeeiooouc') || '%'
      order by (select count(*) from tabelas_precos t where t.development_id = developments.id) desc, length(name) limit 1`,
    [n.slice(0, 80)]
  );
  return r[0] ?? null;
}

async function ultimaTabela(devId: string) {
  const r = await query<{ id: string; mes: string; pagamento: { texto?: string; fluxo?: Parcela[] | null } | null }>(
    `select id, to_char(mes_referencia, 'YYYY-MM') mes, pagamento from tabelas_precos
      where development_id = $1 and tipo = 'lancamento' order by mes_referencia desc, criado_em desc limit 1`,
    [devId]
  );
  return r[0] ?? null;
}

/** Ferramenta "tabela_de_vendas". */
export async function tabelaDeVendas(nome: string): Promise<string> {
  const d = await acharEmpreendimento(nome);
  if (!d) return `Não achei o empreendimento "${nome}" no cadastro. Diga que vai confirmar com a equipe.`;
  const t = await ultimaTabela(d.id);
  if (!t) return `O ${d.name} ainda não tem tabela de vendas gravada no sistema. Diga que a equipe vai enviar a tabela atualizada e use passar_para_atendente se a pessoa quiser.`;
  const grupos = await query<{ area: string; n: string; minimo: string | null }>(
    `select round(area)::text area, count(*)::text n, min(valor)::text minimo from tabelas_precos_unidades
      where tabela_id = $1 and situacao = 'disponivel' group by round(area) order by round(area)`,
    [t.id]
  );
  const linhas = grupos.map((g) => `- ${g.area} m²: ${g.n} disponível(is)${g.minimo ? `, a partir de ${brl0(Number(g.minimo))}` : ''}`);
  const fluxo = t.pagamento?.fluxo;
  const pagamento = fluxo?.length
    ? fluxo.map((p) => `- ${p.nome}: ${pctTxt(p.pct)} do valor${p.qtd > 1 ? ` em ${p.qtd} parcelas` : ''}${p.inicio ? ` (a partir de ${p.inicio})` : ''}`).join('\n')
    : t.pagamento?.texto
      ? `Cabeçalho da tabela (interprete com cuidado, sem inventar):\n${t.pagamento.texto}`
      : 'A tabela não traz a forma de pagamento.';
  return [
    `${d.name}: tabela de vendas de ${mesExtenso(t.mes)}${d.entrega ? `, entrega prevista em ${mesExtenso(d.entrega)}` : ''}.`,
    linhas.length ? `Unidades disponíveis por metragem:\n${linhas.join('\n')}` : 'Nenhuma unidade disponível nessa tabela.',
    `Forma de pagamento da incorporadora:\n${pagamento}`,
    'Lembre: não informe número da unidade nem andar; valores da tabela do mês, sujeitos a reajuste e à disponibilidade.'
  ].join('\n\n');
}

/** Ferramenta "montar_forma_de_pagamento": conforme a tabela ou personalizada. */
export async function montarFormaDePagamento(input: Record<string, unknown>): Promise<{ texto: string; ok: boolean }> {
  const total = Number(input.valor_total);
  if (!(total > 10000)) return { texto: 'Valor total inválido.', ok: false };
  let parcelas: Parcela[] = [];
  let origem = 'personalizada';
  const lista = Array.isArray(input.parcelas) ? (input.parcelas as Record<string, unknown>[]) : [];
  if (lista.length) {
    parcelas = lista.slice(0, 15).map((p) => ({
      nome: String(p.nome ?? 'Parcela').slice(0, 40),
      qtd: Math.max(1, Math.min(240, Math.round(Number(p.qtd) || 1))),
      inicio: p.inicio ? String(p.inicio).slice(0, 30) : null,
      // percentual, ou valor total dessa parcela em reais convertido em percentual
      pct: Number(p.pct) > 0 ? Number(p.pct) : Number(p.valor) > 0 ? (Number(p.valor) / total) * 100 : 0
    }));
  } else if (input.empreendimento) {
    const d = await acharEmpreendimento(String(input.empreendimento));
    const t = d ? await ultimaTabela(d.id) : null;
    if (!t?.pagamento?.fluxo?.length) return { texto: 'Não há forma de pagamento estruturada na tabela desse empreendimento. Peça à equipe ou monte uma personalizada (parcelas).', ok: false };
    parcelas = t.pagamento.fluxo;
    origem = `conforme a tabela de ${mesExtenso(t.mes)} do ${d!.name}`;
  } else return { texto: 'Informe o empreendimento (para usar a tabela) ou as parcelas (personalizada).', ok: false };

  // o que faltar para 100% vira saldo (financiamento ou chaves); se passar de 100%, avisa
  const soma = parcelas.reduce((s, p) => s + p.pct, 0);
  if (soma > 100.5) return { texto: `As parcelas somam ${pctTxt(soma)}, acima de 100%. Ajuste os percentuais.`, ok: false };
  if (soma < 99.5) parcelas = [...parcelas, { nome: String(input.nome_saldo ?? 'Saldo (financiamento ou chaves)'), qtd: 1, inicio: null, pct: 100 - soma }];

  // valores com centavos; o arredondamento vai para a última parcela (a conta fecha no total)
  let acumulado = 0;
  const linhas = parcelas.map((p, i) => {
    const totalParcela = i === parcelas.length - 1 ? total - acumulado : Math.round(((total * p.pct) / 100) * 100) / 100;
    acumulado += totalParcela;
    const cada = Math.round((totalParcela / p.qtd) * 100) / 100;
    return `- ${p.nome}: ${p.qtd > 1 ? `${p.qtd}x de ${brl(cada)}` : brl(totalParcela)}${p.inicio ? ` (a partir de ${p.inicio})` : ''}, ${pctTxt(p.pct)}`;
  });
  return {
    ok: true,
    texto: [
      `Forma de pagamento ${origem}, para ${brl0(total)}:`,
      ...linhas,
      `Total: ${brl(acumulado)}.`,
      origem === 'personalizada'
        ? 'Condição personalizada: é uma proposta, sujeita à aprovação da incorporadora.'
        : 'Valores da tabela, sujeitos a reajuste conforme o contrato (ex.: INCC) e à disponibilidade.'
    ].join('\n')
  };
}

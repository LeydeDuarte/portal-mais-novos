// Indicadores do mercado (Selic, IPCA, INCC, IGP-M) direto da API oficial do Banco
// Central (SGS): https://api.bcb.gov.br/dados/serie/bcdata.sgs.<código>/dados
// Atualiza sozinho uma vez por dia (cron da Vercel em /api/cron/indicadores) e fica
// guardado na tabela "indicadores". Se o Banco Central estiver fora do ar, o site
// continua mostrando o último valor guardado.
import { query } from './db';

export const SERIES = [
  { id: 'selic', codigo: 432, nome: 'Selic', unidade: '% ao ano', tipo: 'nivel', uso: 'juros do financiamento', explica: 'É a taxa básica de juros definida pelo Copom. Quando ela sobe, o financiamento encarece; quando cai, a parcela alivia.' },
  { id: 'ipca', codigo: 433, nome: 'IPCA', unidade: '% no mês', tipo: 'mensal', uso: 'inflação oficial', explica: 'É a inflação oficial do Brasil, medida pelo IBGE. Serve de referência para reajuste de contratos e para saber se o seu imóvel valorizou de verdade ou só acompanhou os preços.' },
  { id: 'incc-di', codigo: 192, nome: 'INCC-DI', unidade: '% no mês', tipo: 'mensal', uso: 'parcelas na planta', explica: 'É o índice de custo da construção da FGV que costuma corrigir as parcelas de quem comprou na planta, até a entrega das chaves. Subiu o cimento e a mão de obra, sobe a parcela.' },
  { id: 'incc-m', codigo: 7456, nome: 'INCC-M', unidade: '% no mês', tipo: 'mensal', uso: 'custo da construção', explica: 'Outra versão do índice de custo da construção da FGV, com coleta do dia 21 ao dia 20. Alguns contratos usam este no lugar do INCC-DI: vale conferir o seu.' },
  { id: 'igpm', codigo: 189, nome: 'IGP-M', unidade: '% no mês', tipo: 'mensal', uso: 'reajuste de aluguel', explica: 'O famoso "índice do aluguel", da FGV. Ainda é o reajuste de muitos contratos de locação, apesar de vários já terem migrado para o IPCA.' }
] as const;
export type SerieId = (typeof SERIES)[number]['id'];
export const serieValida = (id: string): id is SerieId => SERIES.some((s) => s.id === id);

const dataBr = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** Busca no Banco Central e grava (sem apagar nada). Devolve quantos pontos entraram por série. */
export async function atualizarIndicadores(): Promise<Record<string, number | string>> {
  const res: Record<string, number | string> = {};
  const fim = new Date();
  const inicio = new Date(fim.getFullYear() - 10, fim.getMonth(), 1);
  for (const s of SERIES) {
    try {
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${s.codigo}/dados?formato=json&dataInicial=${dataBr(inicio)}&dataFinal=${dataBr(fim)}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const dados = (await r.json()) as { data: string; valor: string }[];
      if (!Array.isArray(dados)) throw new Error('resposta inesperada');
      // Selic é diária: guarda um ponto por mês (o último do mês)
      const porMes = new Map<string, { data: string; valor: number }>();
      for (const d of dados) {
        const [dd, mm, aa] = d.data.split('/');
        const iso = `${aa}-${mm}-${dd}`;
        const v = Number(String(d.valor).replace(',', '.'));
        if (!Number.isFinite(v)) continue;
        const chave = s.tipo === 'nivel' ? `${aa}-${mm}` : iso;
        porMes.set(chave, { data: iso, valor: v });
      }
      const pontos = Array.from(porMes.values());
      for (let i = 0; i < pontos.length; i += 200) {
        const lote = pontos.slice(i, i + 200);
        await query(
          `insert into indicadores (serie, data, valor) select $1, x.data::date, x.valor::numeric
             from jsonb_to_recordset($2::jsonb) as x(data text, valor numeric)
           on conflict (serie, data) do update set valor = excluded.valor`,
          [s.id, JSON.stringify(lote)]
        );
      }
      res[s.id] = pontos.length;
    } catch (e) {
      res[s.id] = `erro: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return res;
}

export type Indicador = {
  id: SerieId;
  nome: string;
  unidade: string;
  uso: string;
  explica: string;
  valor: number | null;
  data: string | null; // AAAA-MM-DD do último ponto
  acumulado12: number | null; // % composto dos últimos 12 meses (mensais)
  historico: { data: string; valor: number }[]; // até 120 meses
};

/** Últimos valores de todos os indicadores (para a capa e a página de indicadores) */
export async function lerIndicadores(meses = 120): Promise<Indicador[]> {
  const rows = await query<{ serie: string; data: string | Date; valor: string }>(
    `select serie, data, valor from indicadores where data > (current_date - ($1::int * interval '1 month')) order by serie, data`,
    [meses]
  ).catch(() => []);
  return SERIES.map((s) => {
    const hist = rows
      .filter((r) => r.serie === s.id)
      .map((r) => ({ data: (r.data instanceof Date ? r.data.toISOString() : String(r.data)).slice(0, 10), valor: Number(r.valor) }));
    const ult = hist[hist.length - 1];
    const ult12 = hist.slice(-12);
    const acumulado12 =
      s.tipo === 'mensal' && ult12.length === 12 ? Math.round((ult12.reduce((a, p) => a * (1 + p.valor / 100), 1) - 1) * 10000) / 100 : null;
    return { id: s.id, nome: s.nome, unidade: s.unidade, uso: s.uso, explica: s.explica, valor: ult?.valor ?? null, data: ult?.data ?? null, acumulado12, historico: hist };
  });
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const mesAno = (iso?: string | null) => (iso ? `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}` : '');
export const pct = (v: number | null, casas = 2) => (v == null ? '-' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`);

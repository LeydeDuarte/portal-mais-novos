// Configuração da IA de atendimento (Painel → CRM → IA). Módulo do servidor.
import { query } from './db';

export type ConfigIA = {
  ligada: boolean;
  /** modo teste: a IA só responde aos números da lista */
  modoTeste: boolean;
  numerosTeste: string[];
  nomeAssistente: string;
  /** simulação média: taxa efetiva ao ano (%), entrada (%) e prazo (meses) */
  taxaMediaAa: number | null;
  entradaPct: number;
  prazoMeses: number;
  /** taxa de balcão por banco (% ao ano), ex.: { "Itaú": 11.6 } */
  taxasBancos: Record<string, number>;
  bancos: string;
  instrucoesExtras: string;
};

export const CONFIG_PADRAO: ConfigIA = {
  ligada: false,
  modoTeste: true,
  numerosTeste: [],
  nomeAssistente: 'Assistente Mais Novos',
  taxaMediaAa: null,
  entradaPct: 20,
  prazoMeses: 420,
  taxasBancos: {},
  bancos: 'Itaú, Bradesco, Santander, Inter e Caixa Econômica Federal',
  instrucoesExtras: ''
};

export async function lerConfigIA(): Promise<ConfigIA> {
  const r = await query<{ valor: Partial<ConfigIA> }>(`select valor from crm_config where chave = 'ia'`).catch(() => []);
  return { ...CONFIG_PADRAO, ...(r[0]?.valor ?? {}) };
}

export async function gravarConfigIA(c: ConfigIA): Promise<void> {
  await query(`insert into crm_config (chave, valor) values ('ia', $1::jsonb) on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`, [JSON.stringify(c)]);
}

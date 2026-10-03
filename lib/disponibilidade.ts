// Unidades disponíveis só aparecem enquanto a tabela de vendas for RECENTE: a do mês atual
// ou dos dois meses anteriores. Sem tabela, ou tabela mais antiga, não aparece número nenhum
// (nunca "0 disponíveis" e nunca um número desatualizado).
export const MESES_VALIDADE_TABELA = 3;

/** true se a tabela (AAAA-MM) ainda vale para mostrar a disponibilidade. */
export function tabelaVigente(referencia: string | null | undefined, hoje: Date = new Date()): boolean {
  if (!referencia || !/^\d{4}-\d{2}/.test(referencia)) return false;
  const [a, m] = referencia.slice(0, 7).split('-').map(Number);
  const meses = (hoje.getFullYear() - a) * 12 + (hoje.getMonth() + 1 - m);
  return meses >= 0 && meses < MESES_VALIDADE_TABELA;
}

/** Quantidade para mostrar no site: só com tabela recente e pelo menos 1 disponível. */
export function disponiveisParaMostrar(disponiveis: number | null | undefined, referencia: string | null | undefined): number | null {
  return disponiveis && disponiveis > 0 && tabelaVigente(referencia) ? disponiveis : null;
}

/** "100% vendido" aparece no site só para lançamento, obras e entregue há até 12 meses. */
export function mostrarVendido100(vendido100: boolean | null | undefined, entrega: string | null | undefined, hoje: Date = new Date()): boolean {
  if (!vendido100 || !entrega || !/^\d{4}-\d{2}/.test(entrega)) return false;
  const [a, m] = entrega.slice(0, 7).split('-').map(Number);
  const mesesDesdeEntrega = (hoje.getFullYear() - a) * 12 + (hoje.getMonth() + 1 - m);
  return mesesDesdeEntrega <= 12;
}

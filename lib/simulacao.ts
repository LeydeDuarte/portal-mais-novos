// Simulação de financiamento (SAC e Price), sem seguros e tarifas (que dependem do banco
// e da idade). Usada pela IA do WhatsApp e, depois, pelo simulador do site.
export type Simulacao = {
  valor: number;
  entrada: number;
  financiado: number;
  prazo: number;
  taxaAa: number;
  sacPrimeira: number;
  sacUltima: number;
  price: number;
  rendaSac: number;
  rendaPrice: number;
};

export function simular(valor: number, entradaPct: number, prazo: number, taxaAa: number): Simulacao {
  const entrada = Math.round(valor * (entradaPct / 100));
  const financiado = valor - entrada;
  const i = Math.pow(1 + taxaAa / 100, 1 / 12) - 1; // taxa efetiva ao mês
  const amort = financiado / prazo;
  const sacPrimeira = amort + financiado * i;
  const sacUltima = amort + amort * i;
  const price = (financiado * i) / (1 - Math.pow(1 + i, -prazo));
  // renda mínima: parcela de até 30% da renda familiar
  return { valor, entrada, financiado, prazo, taxaAa, sacPrimeira, sacUltima, price, rendaSac: sacPrimeira / 0.3, rendaPrice: price / 0.3 };
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export function textoSimulacao(s: Simulacao, banco?: string): string {
  return [
    `${banco ? `Banco: ${banco} (taxa de balcão)` : 'Média dos bancos'} · taxa de ${s.taxaAa.toLocaleString('pt-BR')}% ao ano`,
    `Imóvel ${brl(s.valor)} · entrada ${brl(s.entrada)} · financiado ${brl(s.financiado)} em ${s.prazo} meses`,
    `SAC: 1ª parcela ${brl(s.sacPrimeira)}, caindo até ${brl(s.sacUltima)} · renda familiar a partir de ${brl(s.rendaSac)}`,
    `Price: parcelas de ${brl(s.price)} · renda familiar a partir de ${brl(s.rendaPrice)}`,
    'Valores sem seguros e tarifas do banco; simulação informativa, sujeita a análise de crédito.'
  ].join('\n');
}

// Máscara de moeda pro campo de preço — formata em R$ conforme a pessoa
// digita, guardando só os números por trás.

export function formatCurrencyFromDigits(digits: string): string {
  const cleaned = digits.replace(/\D/g, '');
  if (!cleaned) return '';
  const asNumber = Number(cleaned);
  return asNumber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

// Aceita tanto digitação livre quanto colar um valor já formatado — sempre
// extrai só os dígitos e reformata do zero, pra nunca ficar com máscara torta.
export function maskCurrencyInput(rawValue: string): string {
  return formatCurrencyFromDigits(rawValue);
}

export function appendSuffix(price: string, suffix: string): string {
  return suffix ? `${price}${suffix}` : price;
}

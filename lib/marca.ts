// Links institucionais (fáceis de trocar depois)
// Site da Mais Valor Capital: defina NEXT_PUBLIC_MAIS_VALOR_URL na Vercel quando o
// site estiver no ar. Até lá o botão abre o WhatsApp oficial da Mais Valor.
export const MAIS_VALOR_URL =
  process.env.NEXT_PUBLIC_MAIS_VALOR_URL ||
  `https://wa.me/5562999817077?text=${encodeURIComponent('Olá! Vim pelo portal Mais Novos Imóveis e quero saber sobre crédito imobiliário.')}`;
export const MAIS_VALOR_WHATSAPP = '(62) 9 9981-7077';

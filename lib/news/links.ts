// Links de saída do News: fontes oficiais seguem normais (citar fonte confiável dá credibilidade);
// qualquer outro site recebe "nofollow", para não passar força a portais e imobiliárias concorrentes.
const OFICIAIS = [
  /\.gov\.br$/, /\.jus\.br$/, /\.leg\.br$/, /\.mp\.br$/, /\.def\.br$/, /\.edu\.br$/, /\.edu$/, /\.gov$/, /\.int$/,
  /(^|\.)bcb\.gov\.br$/, /(^|\.)ibge\.gov\.br$/, /(^|\.)ipea\.gov\.br$/,
  /(^|\.)fgv\.br$/, /(^|\.)portal\.fgv\.br$/, /(^|\.)fipe\.org\.br$/, /(^|\.)abecip\.org\.br$/, /(^|\.)cbicdados\.com\.br$/, /(^|\.)cbic\.org\.br$/,
  /(^|\.)secovi\.com\.br$/, /(^|\.)sinduscon-go\.com\.br$/, /(^|\.)ademi-go\.com\.br$/, /(^|\.)ademigo\.com\.br$/, /(^|\.)cofeci\.gov\.br$/, /(^|\.)crecigo\.gov\.br$/,
  /(^|\.)caixa\.gov\.br$/, /(^|\.)bb\.com\.br$/, /(^|\.)itau\.com\.br$/, /(^|\.)bradesco\.com\.br$/, /(^|\.)santander\.com\.br$/, /(^|\.)bancointer\.com\.br$/, /(^|\.)inter\.co$/,
  /(^|\.)b3\.com\.br$/, /(^|\.)cvm\.gov\.br$/, /(^|\.)federalreserve\.gov$/, /(^|\.)imf\.org$/, /(^|\.)worldbank\.org$/, /(^|\.)oecd\.org$/,
  /(^|\.)goiania\.go\.gov\.br$/, /(^|\.)goias\.gov\.br$/, /(^|\.)go\.gov\.br$/,
  // oficiais de fora e agência pública: Banco Central Europeu e União Europeia, ONU, BIS, Agência Brasil
  /(^|\.)europa\.eu$/, /(^|\.)un\.org$/, /(^|\.)bis\.org$/, /(^|\.)ebc\.com\.br$/
];

/** rel do link externo: "noopener" para fonte oficial; "nofollow noopener" para o resto */
export function relSaida(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return OFICIAIS.some((r) => r.test(host)) ? 'noopener' : 'nofollow noopener';
  } catch {
    return 'nofollow noopener';
  }
}

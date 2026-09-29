// Domínios do portal (usados no middleware, que roda no Edge — sem Node aqui).
//  - maisnovosimoveis.com ........ site público
//  - app.maisnovosimoveis.com .... área da equipe (/dashboard), acesso discreto
//  - imoveisavendaemgoias.com.br . site antigo (Jetimob): tudo redireciona 301
export const DOMINIO_PRINCIPAL = 'maisnovosimoveis.com';
export const HOST_APP = `app.${DOMINIO_PRINCIPAL}`;
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || `https://${HOST_APP}`).replace(/\/+$/, '');
export const DASHBOARD_URL = `${APP_URL}/dashboard`;

/** Domínios antigos que só existem para redirecionar (301) para o portal */
export const DOMINIOS_ANTIGOS = ['imoveisavendaemgoias.com.br', 'imoveis-a-venda.com'];

export const semPorta = (host: string | null | undefined) => (host ?? '').toLowerCase().split(':')[0];
export const ehHostApp = (host: string | null | undefined) => semPorta(host) === HOST_APP;
export const ehHostPrincipal = (host: string | null | undefined) => {
  const h = semPorta(host);
  return h === DOMINIO_PRINCIPAL || h === `www.${DOMINIO_PRINCIPAL}`;
};
export const ehDominioAntigo = (host: string | null | undefined) => {
  const h = semPorta(host).replace(/^www\./, '');
  return DOMINIOS_ANTIGOS.includes(h);
};

/** Cookie da equipe vale no site e no app (".maisnovosimoveis.com"); fora do domínio oficial, fica só no host atual. */
export const dominioDoCookie = (host: string | null | undefined): string | undefined => {
  const h = semPorta(host);
  return h === DOMINIO_PRINCIPAL || h.endsWith(`.${DOMINIO_PRINCIPAL}`) ? `.${DOMINIO_PRINCIPAL}` : undefined;
};

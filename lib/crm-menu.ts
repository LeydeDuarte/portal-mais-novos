// Menu do espaço do CRM: tudo o que é relacionamento com o cliente fica aqui dentro.
// Os endereços antigos continuam valendo; só passam a abrir dentro do CRM.
export type ItemCrm = { href: string; nome: string; icone: string; acesso?: 'gestor' | 'admin' };
export const MENU_CRM: { grupo?: string; itens: ItemCrm[] }[] = [
  { itens: [{ href: '/dashboard/crm', nome: 'Hoje', icone: 'sol' }] },
  {
    grupo: 'Funis',
    itens: [
      { href: '/dashboard/crm/funil?f=comprar', nome: 'Vendas', icone: 'funil' },
      { href: '/dashboard/crm/funil?f=vender', nome: 'Captação', icone: 'casa' }
    ]
  },
  {
    grupo: 'Relacionamento',
    itens: [
      { href: '/dashboard/crm/contatos', nome: 'Contatos', icone: 'pessoas' },
      { href: '/dashboard/interessados', nome: 'Interessados', icone: 'pessoa' },
      { href: '/dashboard/propostas', nome: 'Propostas', icone: 'proposta' },
      { href: '/dashboard/proprietarios', nome: 'Proprietários', icone: 'chave' },
      { href: '/dashboard/clientes', nome: 'Clientes do site', icone: 'google' },
      { href: '/dashboard/avisos', nome: 'Para avisar', icone: 'sino', acesso: 'admin' }
    ]
  },
  {
    grupo: 'Gestão',
    itens: [
      { href: '/dashboard/crm/equipe', nome: 'Distribuição', icone: 'equipe', acesso: 'gestor' },
      { href: '/dashboard/crm/ia', nome: 'IA e WhatsApp', icone: 'robo', acesso: 'gestor' }
    ]
  }
];

/** Telas que fazem parte do espaço do CRM (ganham o menu lateral). */
export const PREFIXOS_CRM = ['/dashboard/crm', '/dashboard/interessados', '/dashboard/propostas', '/dashboard/proprietarios', '/dashboard/clientes', '/dashboard/avisos', '/dashboard/vender'];
export const noCrm = (pathname: string) => PREFIXOS_CRM.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Item do menu que corresponde à tela aberta. */
export function itemAtivo(pathname: string, funil: string | null): string {
  if (pathname.startsWith('/dashboard/crm/funil')) return `/dashboard/crm/funil?f=${funil === 'vender' ? 'vender' : 'comprar'}`;
  if (pathname.startsWith('/dashboard/crm/contato')) return '/dashboard/crm/contatos';
  if (pathname.startsWith('/dashboard/vender')) return '/dashboard/crm/funil?f=vender';
  const todos = MENU_CRM.flatMap((g) => g.itens).sort((a, b) => b.href.length - a.href.length);
  return todos.find((i) => !i.href.includes('?') && (pathname === i.href || pathname.startsWith(`${i.href}/`)))?.href ?? '/dashboard/crm';
}

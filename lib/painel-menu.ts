// Ferramentas do painel: uma lista só, usada no menu do topo (PainelNav) e na
// tela inicial (/dashboard). Quem vê cada item:
//   acesso 'todos'      → admin, analista e corretor
//   acesso 'gestor'     → admin e analista
//   acesso 'admin'      → só o administrador principal (papel admin)   [ganha *]
//   acesso 'financeiro' → quem tem acesso ao financeiro                 [ganha *]
import { veTudo } from './papeis';

export type Acesso = 'todos' | 'gestor' | 'admin' | 'financeiro';
export type Icone =
  | 'inicio' | 'casa' | 'predio' | 'mapa' | 'faisca' | 'pdf' | 'imagens' | 'funil' | 'pessoa' | 'proposta' | 'chave'
  | 'sino' | 'placa' | 'google' | 'grafico' | 'radar' | 'jornal' | 'estrela' | 'guindaste' | 'trofeu' | 'moedas'
  | 'equipe' | 'mudanca' | 'perfil';

export type Ferramenta = { href: string; label: string; descricao: string; icone: Icone; acesso: Acesso };
export type Grupo = { titulo: string; itens: Ferramenta[] };

export const GRUPOS: Grupo[] = [
  {
    titulo: 'Imóveis e condomínios',
    itens: [
      { href: '/dashboard/imoveis', label: 'Imóveis', descricao: 'Anúncios, links privados e vendidos.', icone: 'casa', acesso: 'todos' },
      { href: '/dashboard/condominios', label: 'Condomínios', descricao: 'Empreendimentos, tipologias e rascunhos.', icone: 'predio', acesso: 'todos' },
      { href: '/dashboard/mapa', label: 'Mapa', descricao: 'Anúncios e condomínios no mapa.', icone: 'mapa', acesso: 'todos' },
      { href: '/dashboard/cadastro-ia', label: 'Cadastro IA', descricao: 'Cole o texto do anúncio e revise antes de publicar.', icone: 'faisca', acesso: 'gestor' },
      { href: '/dashboard/tabelas', label: 'Tabelas de preços', descricao: 'Tabelas de vendas em massa, com histórico de preços.', icone: 'pdf', acesso: 'gestor' },
      { href: '/dashboard/avaliacoes', label: 'Avaliação de imóveis', descricao: 'Relatório de avaliação com amostras da base e dos portais.', icone: 'grafico', acesso: 'gestor' },
      { href: '/dashboard/importar-pdf', label: 'Importar PDFs', descricao: 'Ficha técnica, tabela de vendas e plantas.', icone: 'pdf', acesso: 'gestor' },
      { href: '/dashboard/importar-imagens', label: 'Importar imagens', descricao: 'Pastas de fotos e plantas por empreendimento.', icone: 'imagens', acesso: 'gestor' }
    ]
  },
  {
    titulo: 'Clientes e negócios',
    itens: [
      { href: '/dashboard/crm', label: 'CRM', descricao: 'Hoje, funis de vendas e captação, contatos.', icone: 'funil', acesso: 'todos' },
      { href: '/dashboard/interessados', label: 'Interessados', descricao: 'Quem pediu contato pelo site e pelo WhatsApp.', icone: 'pessoa', acesso: 'todos' },
      { href: '/dashboard/propostas', label: 'Propostas', descricao: 'Propostas em andamento.', icone: 'proposta', acesso: 'todos' },
      { href: '/dashboard/proprietarios', label: 'Proprietários', descricao: 'Donos dos imóveis anunciados.', icone: 'chave', acesso: 'todos' },
      { href: '/dashboard/avisos', label: 'Para avisar', descricao: 'Lista automática de quem pediu aviso de imóvel.', icone: 'sino', acesso: 'admin' },
      { href: '/dashboard/crm/funil?f=vender', label: 'Captação', descricao: 'Proprietários e quem quer vender pelo site.', icone: 'placa', acesso: 'todos' },
      { href: '/dashboard/clientes', label: 'Clientes', descricao: 'Quem entrou no site com o Google.', icone: 'google', acesso: 'todos' }
    ]
  },
  {
    titulo: 'Mercado e conteúdo',
    itens: [
      { href: '/dashboard/mercado', label: 'Mercado', descricao: 'Preço do m² por bairro, vendidos e excluídos.', icone: 'grafico', acesso: 'gestor' },
      { href: '/dashboard/monitoramento', label: 'Monitoramento', descricao: 'Anúncios da cidade que ainda não temos.', icone: 'radar', acesso: 'gestor' },
      { href: '/dashboard/empresas', label: 'Construtoras', descricao: 'Construtoras, incorporadoras e seus empreendimentos.', icone: 'guindaste', acesso: 'gestor' },
      { href: '/dashboard/news', label: 'News', descricao: 'Notícias do portal: escrever, agendar e publicar.', icone: 'jornal', acesso: 'gestor' },
      { href: '/dashboard/feed-especiais', label: 'Depoimentos e destaques', descricao: 'Cards especiais que entram no feed.', icone: 'estrela', acesso: 'gestor' }
    ]
  },
  {
    titulo: 'Gestão',
    itens: [
      { href: '/dashboard/resultados', label: 'Resultados', descricao: 'Visitas, cliques, contatos e campanhas do portal.', icone: 'trofeu', acesso: 'gestor' },
      { href: '/dashboard/custos', label: 'Custos', descricao: 'IA, WhatsApp e contas a pagar.', icone: 'moedas', acesso: 'financeiro' },
      { href: '/dashboard/equipe', label: 'Equipe', descricao: 'Adicionar pessoas, trocar senha, remover acesso.', icone: 'equipe', acesso: 'admin' },
      { href: '/dashboard/jetimob', label: 'Migração Jetimob', descricao: 'Trazer condomínios, imóveis e fotos da Jetimob.', icone: 'mudanca', acesso: 'admin' },
      { href: '/dashboard/perfil', label: 'Meu perfil', descricao: 'Seus dados, foto e senha.', icone: 'perfil', acesso: 'todos' }
    ]
  }
];

/** Ordem do menu do topo (mesma de antes). */
export const ORDEM_MENU = [
  '/dashboard/crm', '/dashboard/resultados', '/dashboard/custos', '/dashboard/imoveis', '/dashboard/condominios', '/dashboard/mapa', '/dashboard/avaliacoes', '/dashboard/tabelas',
  '/dashboard/empresas', '/dashboard/mercado', '/dashboard/monitoramento', '/dashboard/importar-pdf',
  '/dashboard/importar-imagens', '/dashboard/cadastro-ia', '/dashboard/news', '/dashboard/feed-especiais', '/dashboard/jetimob',
  '/dashboard/equipe', '/dashboard/perfil'
];

export const TODAS: Ferramenta[] = GRUPOS.flatMap((g) => g.itens);

/** Itens que só o administrador principal vê (levam o asterisco). */
export const soAdminPrincipal = (f: Ferramenta) => f.acesso === 'admin' || f.acesso === 'financeiro';

/** A pessoa pode ver esta ferramenta? */
export function podeVer(f: Ferramenta, role: string | undefined, financeiro: boolean): boolean {
  if (role === 'financeiro') return f.acesso === 'financeiro';
  if (f.acesso === 'admin') return role === 'admin';
  if (f.acesso === 'financeiro') return financeiro;
  if (f.acesso === 'gestor') return veTudo(role);
  return true;
}

/** Nome mostrado (corretor vê "Meus imóveis"). */
export const rotuloFerramenta = (f: Ferramenta, role?: string) => (f.href === '/dashboard/imoveis' && !veTudo(role) ? 'Meus imóveis' : f.label);

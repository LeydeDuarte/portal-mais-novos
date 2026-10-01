'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo, ROLE_LABEL } from '@/lib/papeis';
import Logo from './Logo';
import { SITE_URL } from '@/lib/seo';

const LINKS: { href: string; label: string; admin?: boolean; gestor?: boolean }[] = [
  { href: '/dashboard', label: 'Início' },
  { href: '/dashboard/resultados', label: 'Resultados', admin: true },
  { href: '/dashboard/imoveis', label: 'Imóveis' },
  { href: '/dashboard/condominios', label: 'Condomínios' },
  { href: '/dashboard/mapa', label: 'Mapa' },
  { href: '/dashboard/proprietarios', label: 'Proprietários' },
  { href: '/dashboard/propostas', label: 'Propostas' },
  { href: '/dashboard/interessados', label: 'Interessados' },
  { href: '/dashboard/vender', label: 'Quero vender' },
  { href: '/dashboard/empresas', label: 'Construtoras' },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/mercado', label: 'Mercado' },
  { href: '/dashboard/monitoramento', label: 'Monitoramento' },
  { href: '/dashboard/importar-pdf', label: 'Importar PDFs' },
  { href: '/dashboard/cadastro-ia', label: 'Cadastro IA' },
  { href: '/dashboard/news', label: 'News', gestor: true },
  { href: '/dashboard/feed-especiais', label: 'Depoimentos e destaques', gestor: true },
  { href: '/dashboard/jetimob', label: 'Migração Jetimob', admin: true },
  { href: '/dashboard/equipe', label: 'Equipe', admin: true },
  { href: '/dashboard/perfil', label: 'Meu perfil' }
];

// Topo do painel (fixo): marca + atalhos à esquerda, pessoa e Sair à direita;
// embaixo, as seções em "pílulas" que rolam para o lado no celular.
export default function PainelNav() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { staff, logout } = useStaffSession();

  const sair = async () => {
    await logout();
    router.push('/dashboard/login');
  };
  const ativo = (href: string) => (href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/85">
      <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-3 px-4 md:px-6">
        {/* a logo leva para o SITE; a etiqueta PAINEL leva ao início do painel */}
        <a href={SITE_URL} className="flex items-center" aria-label="Ir para o site Mais Novos Imóveis">
          <Logo tipo="simbolo" altura={28} className="md:hidden" />
          <Logo tipo="completo" altura={34} className="hidden md:block" />
        </a>
        <Link href="/dashboard" className="hidden rounded-full bg-[var(--pill-bg)] px-2.5 py-1 text-[11px] font-bold tracking-widest hover:bg-[var(--pill-bg-hover)] md:inline-flex">
          PAINEL
        </Link>
        <Link
          href="/dashboard/imoveis/novo"
          className="ml-2 flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-white hover:opacity-90"
        >
          <span className="text-lg leading-none">+</span> <span className="hidden sm:inline">Cadastrar</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <a href={SITE_URL} target="_blank" rel="noopener" className="hidden h-10 items-center rounded-full px-3.5 text-[13px] font-semibold hover:bg-[var(--pill-bg)] md:flex">
            Ver site ↗
          </a>
          {staff && (
            <Link href="/dashboard/perfil" title="Meu perfil" className="hidden items-center gap-2 rounded-full bg-[var(--pill-bg)] py-1 pl-1 pr-3 hover:bg-[var(--pill-bg-hover)] sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[13px] font-bold text-white">{staff.name.slice(0, 1).toUpperCase()}</span>
              <span className="leading-tight">
                <span className="block max-w-[140px] truncate text-[13px] font-semibold">{staff.name}</span>
                <span className="block text-[10.5px] text-[var(--text-muted)]">{ROLE_LABEL[staff.role] ?? staff.role} · meu perfil</span>
              </span>
            </Link>
          )}
          {staff && (
            <button
              type="button"
              onClick={sair}
              className="flex h-10 items-center gap-1.5 rounded-full border border-red-200 px-3.5 text-[13px] font-bold text-red-600 hover:bg-red-50 dark:border-red-900"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Sair
            </button>
          )}
        </div>
      </div>
      {staff && (
        <nav className="mx-auto flex h-12 max-w-[1680px] items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:px-6">
          {LINKS.filter((l) => (!l.admin || staff.role === 'admin') && (!l.gestor || veTudo(staff.role))).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${ativo(l.href) ? 'bg-ink text-white' : 'hover:bg-[var(--pill-bg)]'}`}
            >
              {l.href === '/dashboard/imoveis' && !veTudo(staff.role) ? 'Meus imóveis' : l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStaffSession } from '@/lib/use-staff-session';
import { temAcessoFinanceiro } from '@/lib/actions-custos';
import { ROLE_LABEL } from '@/lib/papeis';
import { ORDEM_MENU, TODAS, podeVer, rotuloFerramenta, soAdminPrincipal, type Ferramenta } from '@/lib/painel-menu';
import Logo from './Logo';
import { SITE_URL } from '@/lib/seo';

// Itens do menu: lista única em lib/painel-menu.ts (também usada na tela inicial)
const LINKS = [
  { href: '/dashboard', label: 'Início', acesso: 'todos' as const },
  ...ORDEM_MENU.map((h) => TODAS.find((f) => f.href === h)).filter((f): f is Ferramenta => !!f)
];

// Topo do painel (fixo): marca + atalhos à esquerda, pessoa e Sair à direita;
// embaixo, as seções em "pílulas" que rolam para o lado no celular.
export default function PainelNav() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { staff, logout } = useStaffSession();
  // "Custos" só aparece para quem tem acesso ao financeiro (o papel Financeiro vê só ele)
  const [financeiro, setFinanceiro] = useState(false);
  // setas para rolar o menu no computador (as seções não cabem numa linha)
  const menuRef = useRef<HTMLElement>(null);
  const [setas, setSetas] = useState({ esq: false, dir: false });
  const medir = useCallback(() => {
    const el = menuRef.current;
    if (!el) return;
    setSetas({ esq: el.scrollLeft > 4, dir: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    medir();
    // a seção aberta fica à vista
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    el.addEventListener('scroll', medir, { passive: true });
    // roda do mouse (para cima/baixo) também anda o menu para o lado
    const roda = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', medir);
      el.removeEventListener('wheel', roda);
    };
  }, [medir, staff, financeiro]);
  const rolar = (lado: 1 | -1) => menuRef.current?.scrollBy({ left: lado * Math.max(240, (menuRef.current?.clientWidth ?? 600) * 0.7), behavior: 'smooth' });
  useEffect(() => {
    if (staff) temAcessoFinanceiro().then(setFinanceiro).catch(() => setFinanceiro(false));
  }, [staff]);

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
        <div className="relative mx-auto max-w-[1680px]">
        {setas.esq && (
          <button
            type="button"
            onClick={() => rolar(-1)}
            aria-label="Ver seções anteriores"
            className="absolute left-0 top-0 z-10 hidden h-12 w-14 items-center justify-start bg-gradient-to-r from-[var(--bg)] via-[var(--bg)] to-transparent pl-2 md:flex"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-lg shadow-sm hover:border-accent hover:text-accent">‹</span>
          </button>
        )}
        {setas.dir && (
          <button
            type="button"
            onClick={() => rolar(1)}
            aria-label="Ver mais seções"
            className="absolute right-0 top-0 z-10 hidden h-12 w-14 items-center justify-end bg-gradient-to-l from-[var(--bg)] via-[var(--bg)] to-transparent pr-2 md:flex"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-lg shadow-sm hover:border-accent hover:text-accent">›</span>
          </button>
        )}
        <nav ref={menuRef} className="flex h-12 items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:px-6">
          {LINKS.filter((l) => l.href === '/dashboard' ? staff.role !== 'financeiro' : podeVer(l as Ferramenta, staff.role, financeiro)).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={ativo(l.href) ? 'page' : undefined}
              title={l.href !== '/dashboard' && soAdminPrincipal(l as Ferramenta) ? 'Só o administrador principal vê' : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${ativo(l.href) ? 'bg-ink text-white' : 'hover:bg-[var(--pill-bg)]'}`}
            >
              {l.href === '/dashboard' ? l.label : rotuloFerramenta(l as Ferramenta, staff.role)}
              {l.href !== '/dashboard' && soAdminPrincipal(l as Ferramenta) && <span className={ativo(l.href) ? 'ml-0.5' : 'ml-0.5 text-accent'}>*</span>}
            </Link>
          ))}
        </nav>
        </div>
      )}
    </div>
  );
}

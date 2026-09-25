'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';

const LINKS = [
  { href: '/dashboard', label: 'Painel' },
  { href: '/dashboard/imoveis/novo', label: 'Cadastrar' },
  { href: '/dashboard/cadastro-ia', label: 'Cadastro IA' },
  { href: '/dashboard/importar-pdf', label: 'Importar PDFs' },
  { href: '/dashboard/monitoramento', label: 'Monitoramento' },
  { href: '/dashboard/imoveis', label: 'Meus imóveis' },
  { href: '/dashboard/condominios', label: 'Condomínios' },
  { href: '/dashboard/interessados', label: 'Interessados' },
  { href: '/dashboard/propostas', label: 'Propostas' },
  { href: '/dashboard/vender', label: 'Quero vender' },
  { href: '/dashboard/feed-especiais', label: 'Depoimentos e destaques', gestor: true },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/mercado', label: 'Mercado' },
  { href: '/dashboard/jetimob', label: 'Migração Jetimob', admin: true },
  { href: '/dashboard/equipe', label: 'Equipe', admin: true }
];

// Menu de ferramentas do painel — aparece em toda página interna, pra nunca
// deixar a pessoa "presa" numa tela de cadastro sem forma de voltar.
export default function PainelNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { staff, logout } = useStaffSession();

  const handleLogout = async () => {
    await logout();
    router.push('/dashboard/login');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[var(--pill-bg)]/40 px-5 py-2.5 md:px-8">
      {LINKS.filter((l) => (!('admin' in l) || staff?.role === 'admin') && (!('gestor' in l) || veTudo(staff?.role))).map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
            pathname === link.href ? 'bg-ink text-white' : 'hover:bg-[var(--pill-bg)]'
          }`}
        >
          {link.href === '/dashboard/imoveis' && veTudo(staff?.role) ? 'Imóveis' : link.label}
        </Link>
      ))}
      {staff && (
        <button type="button" onClick={handleLogout} className="ml-auto rounded-full px-3.5 py-1.5 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--pill-bg)]">
          Sair
        </button>
      )}
    </div>
  );
}

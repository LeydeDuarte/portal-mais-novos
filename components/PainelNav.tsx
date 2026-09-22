'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStaffSession } from '@/lib/use-staff-session';

const LINKS = [
  { href: '/painel', label: 'Painel' },
  { href: '/painel/imoveis/novo', label: 'Cadastrar' },
  { href: '/painel/cadastro-ia', label: 'Cadastro IA' },
  { href: '/painel/monitoramento', label: 'Monitoramento' },
  { href: '/painel/imoveis', label: 'Meus imóveis' }
];

// Menu de ferramentas do painel — aparece em toda página interna, pra nunca
// deixar a pessoa "presa" numa tela de cadastro sem forma de voltar.
export default function PainelNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { staff, logout } = useStaffSession();

  const handleLogout = async () => {
    await logout();
    router.push('/painel/login');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[var(--pill-bg)]/40 px-5 py-2.5 md:px-8">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
            pathname === link.href ? 'bg-ink text-white' : 'hover:bg-[var(--pill-bg)]'
          }`}
        >
          {link.label}
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

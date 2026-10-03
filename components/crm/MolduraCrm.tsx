'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { MENU_CRM, itemAtivo, noCrm, type ItemCrm } from '@/lib/crm-menu';

// Espaço do CRM: menu lateral fixo (computador) em todas as telas de relacionamento.
// No celular o menu é a faixa de abas (CrmNav), que cada tela mostra embaixo do topo.
const ICONE: Record<string, JSX.Element> = {
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  funil: <path d="M3 5h18l-7 8v6l-4 2v-8Z" />,
  casa: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M12 13v4M10 15h4" /></>,
  pessoas: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3 19a6 6 0 0 1 12 0M15 14.5a5 5 0 0 1 6 4.5" /></>,
  pessoa: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  proposta: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6M9 12h6" /></>,
  chave: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l2 2M14 9l2 2" /></>,
  google: <><circle cx="12" cy="12" r="8" /><path d="M12 12h7" /><path d="M17.7 7A8 8 0 0 0 4 12" /></>,
  sino: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  equipe: <><circle cx="9" cy="8" r="3" /><path d="M3 19a6 6 0 0 1 12 0" /><path d="m16 11 2 2 4-4" /></>,
  robo: <><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5" /></>
};

export function itensVisiveis(role: string | undefined): { grupo?: string; itens: ItemCrm[] }[] {
  return MENU_CRM.map((g) => ({ ...g, itens: g.itens.filter((i) => !i.acesso || (i.acesso === 'admin' ? role === 'admin' : veTudo(role))) })).filter((g) => g.itens.length);
}

export default function MolduraCrm({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const busca = useSearchParams();
  const { staff } = useStaffSession();
  if (!noCrm(pathname) || !staff) return <>{children}</>;
  const ativo = itemAtivo(pathname, busca?.get('f') ?? null);
  return (
    <div className="md:flex">
      <aside aria-label="Menu do CRM" className="sticky top-0 hidden h-screen w-[208px] shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--pill-bg)]/50 px-3 pb-6 pt-4 md:flex">
        <Link href="/dashboard/crm" className="mb-3 px-2 font-serif text-[18px] font-semibold tracking-tight">
          CRM
        </Link>
        {itensVisiveis(staff.role).map((g, k) => (
          <div key={k} className="mb-3">
            {g.grupo && <div className="px-2 pb-1 pt-2 text-[11.5px] font-semibold text-[var(--text-muted)]">{g.grupo}</div>}
            {g.itens.map((i) => {
              const on = i.href === ativo;
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={on ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] transition-colors ${on ? 'bg-[var(--bg)] font-semibold shadow-sm ring-1 ring-[var(--border)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'}`}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={on ? 'text-accent' : ''}>
                    {ICONE[i.icone]}
                  </svg>
                  {i.nome}
                  {i.acesso === 'admin' && <span className="ml-auto text-accent" title="Só o administrador principal vê">*</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

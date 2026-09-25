'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import LoginModal from './LoginModal';
import { useSession } from '@/lib/use-session';
import type { Cliente } from '@/lib/cliente-auth';

// Campo de busca do topo.
// - No feed (Comprar/Lançamentos): cada Enter vira um "balão" na barra de
//   filtros e o campo esvazia para a próxima palavra (ex: "marista" Enter,
//   "bueno" Enter → dois balões, mostra os dois bairros).
// - Nas outras páginas: leva para o feed já com a busca (?q=).
export default function Header({ searchSlot }: { searchSlot?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const { session, signIn, signOut } = useSession();
  const [login, setLogin] = useState<null | 'favoritos' | 'entrar'>(null);
  const [menu, setMenu] = useState(false);
  const abrirFavoritos = () => (session.loggedIn ? router.push('/favoritos') : setLogin('favoritos'));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    const base = pathname === '/lancamentos' ? '/lancamentos' : '/';
    router.push(`${base}?q=${encodeURIComponent(term)}`);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-[var(--border)] bg-[var(--bg)] px-5 py-2.5 md:gap-6 md:px-8 md:py-3">
      <a href="/" className="shrink-0 font-serif text-[19px] font-semibold whitespace-nowrap">
        Mais Novos <span className="text-accent">Imóveis</span>
      </a>

      <nav className="hidden items-center gap-1 md:flex">
        {[
          { label: 'Comprar', href: '/' },
          { label: 'Lançamentos', href: '/lancamentos' },
          { label: 'Financiamento', href: '/financiamento' },
          { label: 'News', href: '/news' },
          { label: 'Quem somos', href: '/quem-somos' }
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            className="rounded-full px-3.5 py-2.5 text-sm font-semibold hover:bg-[var(--pill-bg)]"
          >
            {label}
          </a>
        ))}
      </nav>

      {searchSlot ?? (
      <form onSubmit={submit} role="search" className="flex max-w-[560px] flex-grow items-center gap-2 rounded-full bg-[var(--pill-bg)] px-4 py-2.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--text-muted)]">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por cidade, bairro, condomínio ou tipo"
          aria-label="Buscar imóveis"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
        />
      </form>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button type="button" aria-label="Favoritos" onClick={abrirFavoritos} className="flex h-[38px] w-[38px] items-center justify-center rounded-full hover:bg-[var(--pill-bg)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.6 6.9 4.3 5.4c2.2-1.2 4.9-.5 6.2 1.6l1.5 2.4 1.5-2.4c1.3-2.1 4-2.8 6.2-1.6 2.7 1.5 3.3 4.7 1.6 7.4C18.7 16.65 12 21 12 21z" />
          </svg>
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label={session.loggedIn ? 'Minha conta' : 'Entrar'}
            onClick={() => (session.loggedIn ? setMenu((m) => !m) : setLogin('entrar'))}
            className="flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full hover:bg-[var(--pill-bg)]"
          >
            {session.cliente?.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.cliente.foto} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
            ) : session.loggedIn ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{(session.cliente?.nome ?? 'V').slice(0, 1).toUpperCase()}</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </button>
          {menu && session.loggedIn && (
            <div className="absolute right-0 top-11 z-40 w-56 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 text-sm shadow-xl">
              {session.cliente && <div className="truncate px-3 py-2 text-xs text-[var(--text-muted)]">{session.cliente.email}</div>}
              <a href="/favoritos" className="block rounded-lg px-3 py-2 font-semibold hover:bg-[var(--pill-bg)]">Meus favoritos</a>
              <button
                type="button"
                onClick={async () => {
                  setMenu(false);
                  await signOut();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--pill-bg)]"
              >
                Sair
              </button>
            </div>
          )}
        </div>
        <a href="/vender" className="hidden whitespace-nowrap rounded-full bg-ink px-4.5 py-2.5 text-[13px] font-bold text-white hover:opacity-90 md:inline-block">
          Venda seu imóvel
        </a>
      </div>

      <LoginModal
        open={!!login}
        onClose={() => setLogin(null)}
        titulo={login === 'favoritos' ? 'Entre para ver seus favoritos' : 'Entrar na Mais Novos Imóveis'}
        onSignIn={(c?: Cliente | null) => {
          signIn(c);
          const destino = login;
          setLogin(null);
          if (destino === 'favoritos') router.push('/favoritos');
        }}
      />
    </header>
  );
}

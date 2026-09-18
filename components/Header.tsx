export default function Header() {
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
          { label: 'News', href: '/news' }
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

      <div className="flex max-w-[560px] flex-grow items-center gap-2 rounded-full bg-[var(--pill-bg)] px-4 py-2.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--text-muted)]">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por cidade, bairro ou condomínio"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button type="button" aria-label="Favoritos" className="flex h-[38px] w-[38px] items-center justify-center rounded-full hover:bg-[var(--pill-bg)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.6 6.9 4.3 5.4c2.2-1.2 4.9-.5 6.2 1.6l1.5 2.4 1.5-2.4c1.3-2.1 4-2.8 6.2-1.6 2.7 1.5 3.3 4.7 1.6 7.4C18.7 16.65 12 21 12 21z" />
          </svg>
        </button>
        <button type="button" aria-label="Entrar" className="flex h-[38px] w-[38px] items-center justify-center rounded-full hover:bg-[var(--pill-bg)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
        <a href="#" className="hidden whitespace-nowrap rounded-full bg-ink px-4.5 py-2.5 text-[13px] font-bold text-white hover:opacity-90 md:inline-block">
          Anunciar imóvel
        </a>
      </div>
    </header>
  );
}

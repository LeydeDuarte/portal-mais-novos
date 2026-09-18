export default function Footer() {
  return (
    <footer className="flex flex-col gap-5 border-t border-[var(--border)] px-5 pb-6 pt-8 md:px-8 md:pt-11 md:pb-7">
      <div className="flex flex-wrap justify-between gap-7">
        <div className="flex max-w-[320px] flex-col gap-2">
          <div className="font-serif text-[19px] font-semibold">Mais Novos Imóveis</div>
          <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
            Estruturação de Ativos Imobiliários — compra, venda, financiamento e Home Equity em Goiânia e para
            brasileiros no exterior.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">Navegação</span>
          {[
            { label: 'Comprar', href: '/' },
            { label: 'Lançamentos', href: '/lancamentos' },
            { label: 'Financiamento', href: '/financiamento' },
            { label: 'News', href: '/news' }
          ].map(({ label, href }) => (
            <a key={label} href={href} className="text-[13px] text-[var(--text-muted)]">
              {label}
            </a>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">Contato</span>
          <p className="text-[13px] text-[var(--text-muted)]">Goiânia, Goiás — Brasil</p>
          <a href="#" className="text-[13px] text-[var(--text-muted)]">
            Instagram @leydeduarte.br
          </a>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-1.5 border-t border-[var(--border)] pt-4 text-[11px] text-[var(--text-faint)]">
        <span>© 2026 Mais Novos Inteligência Imobiliária — CNPJ 36.006.396/0001-21</span>
        <span>CRECI C17586 · Correspondente bancário 185260817022749</span>
      </div>
    </footer>
  );
}

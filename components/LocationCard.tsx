type Props = {
  title: string; // ex: "Residencial Jardins do Cerrado" ou "Setor Bueno"
  subtitle: string; // ex: "Jardim Goiás, Goiânia — GO"
  mapsQuery: string; // o que abre no Google Maps ao clicar
  approximate?: boolean; // imóvel de rua: só a região, nunca o endereço exato
};

// Seção "Localização" no final da página do imóvel/empreendimento.
// O fundo é uma textura de mapa desenhada aqui mesmo (sem custo de API);
// o mapa de verdade só abre quando a pessoa clica.
export default function LocationCard({ title, subtitle, mapsQuery, approximate }: Props) {
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  return (
    <section className="mt-10" aria-label="Localização">
      <h2 className="mb-3 text-lg font-bold">Localização</h2>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="group relative flex h-[170px] items-center justify-center overflow-hidden rounded-2xl bg-[#f1f3f5] px-5"
      >
        <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 600 170" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <rect width="600" height="170" fill="#f1f3f5" />
          <path d="M430 10 C500 0 560 40 560 90 C560 140 500 160 450 150 C400 140 380 90 395 50 C402 30 412 15 430 10Z" fill="#e3ebe0" />
          <g stroke="#fff" strokeLinecap="round" fill="none">
            <path d="M-10 60 C150 50 320 80 610 40" strokeWidth="11" />
            <path d="M-10 128 C200 115 400 140 610 118" strokeWidth="8" />
            <path d="M170 -10 C180 60 160 120 190 180" strokeWidth="11" />
            <path d="M360 -10 L372 180" strokeWidth="7" />
            <path d="M60 -10 L78 180" strokeWidth="5" />
            <path d="M260 -10 L270 180" strokeWidth="5" />
            <path d="M470 -10 L462 180" strokeWidth="5" />
            <path d="M-10 95 L610 85" strokeWidth="4" />
            <path d="M-10 25 L610 18" strokeWidth="4" />
            <path d="M540 -10 L530 180" strokeWidth="4" />
          </g>
        </svg>
        {approximate && (
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-accent/70 bg-accent/10"
          />
        )}
        <span className="relative flex w-full max-w-[360px] items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-[0_2px_10px_rgba(20,22,26,0.10)] transition-shadow group-hover:shadow-[0_4px_16px_rgba(20,22,26,0.16)]">
          <svg width="22" height="22" viewBox="0 0 24 24" className="shrink-0 text-accent" fill="currentColor" aria-hidden>
            <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
          </svg>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold text-ink">{title}</span>
            <span className="truncate text-sm text-[var(--text-muted)]">{subtitle}</span>
            {approximate && <span className="mt-0.5 text-xs font-semibold text-accent">Localização aproximada</span>}
          </span>
          <span className="shrink-0 text-lg text-ink" aria-hidden>
            ›
          </span>
        </span>
      </a>
      {approximate && (
        <p className="mt-2 text-xs text-[var(--text-faint)]">
          Por segurança do proprietário, mostramos só a região. O endereço exato é informado pelo corretor.
        </p>
      )}
    </section>
  );
}

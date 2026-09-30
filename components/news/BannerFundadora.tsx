// Banner pequeno e animado: "Conheça a fundadora do Portal Mais Novos" → Instagram da Leyde.
// Animações só em CSS (globals.css: fundadora-*), desligadas para quem pede menos movimento.
const INSTAGRAM = 'https://www.instagram.com/leydeduarte.br/';

export default function BannerFundadora({ className = '' }: { className?: string }) {
  return (
    <a
      href={INSTAGRAM}
      target="_blank"
      rel="noopener"
      aria-label="Conheça a fundadora do Portal Mais Novos, Leyde Duarte, no Instagram @leydeduarte.br"
      className={`fundadora-card group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 transition-shadow hover:shadow-[0_10px_30px_rgba(20,22,26,0.10)] ${className}`}
    >
      <span className="fundadora-brilho" aria-hidden />
      <span className="relative h-[76px] w-[76px] shrink-0">
        <span className="fundadora-anel absolute inset-0 rounded-full" aria-hidden />
        <span className="absolute inset-[3px] overflow-hidden rounded-full border-2 border-[var(--bg)] bg-[var(--pill-bg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/leyde-duarte-rosto.webp" alt="Leyde Duarte, fundadora do Portal Mais Novos" width={70} height={70} className="fundadora-foto h-full w-full object-cover" loading="lazy" />
        </span>
      </span>
      <span className="relative flex min-w-0 flex-col">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">Conheça a fundadora</span>
        <span className="font-serif text-[19px] font-semibold leading-tight">Leyde Duarte</span>
        <span className="text-[12px] leading-snug text-[var(--text-muted)]">Fundadora do Portal Mais Novos</span>
        <span className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="text-[#D6246E]">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
          </svg>
          @leydeduarte.br
          <span className="fundadora-seta" aria-hidden>
            →
          </span>
        </span>
      </span>
    </a>
  );
}

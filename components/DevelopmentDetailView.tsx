import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DevelopmentUnitsSection from '@/components/DevelopmentUnitsSection';
import { getAveragePricePerM2, formatPricePerM2, type Development } from '@/lib/property-details';
import { getStatusBadge } from '@/lib/classification';
import { getEmbedInfo } from '@/lib/video-embed';

export default function DevelopmentDetailView({ development }: { development: Development }) {
  const badge = getStatusBadge(development.deliveryDate);
  const embed = development.videoUrl ? getEmbedInfo(development.videoUrl) : null;
  const avgPricePerM2 = getAveragePricePerM2(development.units);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Voltar para a Home
        </Link>

        <div
          className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-[var(--card-img-bg)]"
          style={{ height: development.heroHeight }}
        >
          {embed ? (
            <iframe
              src={embed.embedUrl}
              className="h-full w-full"
              style={{ border: 0 }}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              title="Vídeo do empreendimento"
            />
          ) : (
            <span className="text-sm text-[var(--text-faint)]">[FOTO DO EMPREENDIMENTO]</span>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide"
              style={{ background: badge.bg, color: badge.color }}
            >
              {badge.text}
            </span>
            {development.aceitaTemporada && (
              <span className="flex items-center gap-1.5 rounded-md bg-emerald-700/85 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Aceita temporada
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <h1 className="font-serif text-2xl font-semibold">{development.name}</h1>
          <span className="text-sm text-[var(--text-muted)]">{development.location}</span>
          <span className="text-sm font-semibold text-accent">{development.deliveryNote}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-y border-[var(--border)] py-3 text-sm">
          <span className="text-[var(--text-muted)]">
            {development.tipo === 'vertical' ? 'Condomínio vertical' : 'Condomínio horizontal'}
          </span>
          {development.pavimentos && (
            <span className="text-[var(--text-muted)]">{development.pavimentos} pavimentos</span>
          )}
          {development.areaTerreno && (
            <span className="text-[var(--text-muted)]">Terreno de {development.areaTerreno}</span>
          )}
          {avgPricePerM2 > 0 && (
            <span className="font-semibold text-ink">A partir de {formatPricePerM2(avgPricePerM2)}</span>
          )}
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">{development.description}</p>

        <div className="mt-6">
          <h2 className="mb-3 text-lg font-bold">Lazer e diferenciais</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {development.amenities.map((a) => (
              <li key={a} className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {a}
              </li>
            ))}
          </ul>
        </div>

        <DevelopmentUnitsSection development={development} />
      </main>

      <Footer />
    </div>
  );
}

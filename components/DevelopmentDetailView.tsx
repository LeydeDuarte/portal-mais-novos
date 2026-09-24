import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PhotoGallery, { type GalleryVideo } from '@/components/PhotoGallery';
import LocationCard from '@/components/LocationCard';
import RelatedListings, { faixaDePreco } from '@/components/RelatedListings';
import { getRelatedListings } from '@/lib/actions';
import { getAveragePricePerM2, formatPricePerM2, type Development } from '@/lib/property-details';
import { getStatusBadge } from '@/lib/classification';
import { getEmbedInfo, getYouTubeAspectRatio } from '@/lib/video-embed';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';

export default async function DevelopmentDetailView({ development }: { development: Development }) {
  const badge = development.deliveryDate
    ? getStatusBadge(development.deliveryDate)
    : { text: 'Entrega a confirmar', bg: 'rgba(20,22,26,0.72)', color: '#fff', bucket: 'usado' as const, label: '', year: 0 };
  const tipologias = development.units.filter((u) => u.isTipologia);
  const related = await getRelatedListings({ developmentId: development.id }).catch(() => ({ mesmoCondominio: [], regiao: [], precoReferencia: null }));
  const futuro = !!development.deliveryDate && badge.bucket === 'lancamento';
  const embed = development.videoUrl ? getEmbedInfo(development.videoUrl) : null;
  const avgPricePerM2 = getAveragePricePerM2(development.units);

  const youtubeAspect = embed?.platform === 'youtube' ? await getYouTubeAspectRatio(embed.videoId) : null;
  const galleryVideo: GalleryVideo | null = embed
    ? { embedUrl: embed.embedUrl, platform: embed.platform, ratio: youtubeAspect ? youtubeAspect.width / youtubeAspect.height : undefined }
    : null;

  const photos = development.photos ?? [];
  // Com vídeo, ele ocupa o lugar da foto principal da galeria; sem vídeo, a foto de capa.
  const hasGallery = photos.length > 0 || !!galleryVideo;
  const showMediaBlock = !hasGallery;
  const tipos = Array.from(new Set([...(development.tiposUnidade ?? []), ...development.units.map((u) => u.tipoUnidade)]));
  const quartosConhecidos = Array.from(
    new Set([...(development.quartosOpcoes ?? []), ...development.units.map((u) => parseInt(u.beds, 10)).filter((n) => Number.isFinite(n))])
  ).sort((a, b) => a - b);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Voltar para a Home
        </Link>

        {development.status === 'rascunho' && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <span>
              <strong>Rascunho — não aparece no site.</strong> Só a equipe logada vê esta página.
            </span>
            <Link href={`/painel/condominios/${development.id}/editar`} className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white">
              Finalizar e publicar
            </Link>
          </div>
        )}

        {hasGallery && (
          <section aria-label="Fotos do empreendimento" className={showMediaBlock ? 'mb-6' : ''}>
            <PhotoGallery
              photos={photos}
              video={galleryVideo}
              alt={development.name}
              badges={
                <span className="rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide" style={{ background: badge.bg, color: badge.color }}>
                  {badge.text}
                </span>
              }
            />
          </section>
        )}

        {showMediaBlock && (
        <div
          className="relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[var(--card-img-bg)]"
          style={{ height: development.heroHeight }}
        >
          <span className="text-sm text-[var(--text-faint)]">[FOTO DO EMPREENDIMENTO]</span>
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
        )}

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

        {(tipos.length > 0 || quartosConhecidos.length > 0) && (
          <div className="mt-4 flex flex-col gap-2">
            {tipos.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">Tipos de imóvel</span>
                {tipos.map((t) => (
                  <span key={t} className="rounded-full bg-[var(--pill-bg)] px-3 py-1 text-xs font-semibold">
                    {TIPO_UNIDADE_LABEL[t]}
                  </span>
                ))}
              </div>
            )}
            {quartosConhecidos.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">Opções de quartos</span>
                {quartosConhecidos.map((q) => (
                  <span key={q} className="rounded-full bg-[var(--pill-bg)] px-3 py-1 text-xs font-semibold">
                    {q} {q === 1 ? 'quarto' : 'quartos'}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

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

        {(tipologias.length > 0 || futuro) && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold">
            {tipologias.length > 0 ? 'Tipologias' : 'Tipologias em breve'}
          </h2>
          {tipologias.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              As metragens e valores de cada tipologia ainda não foram divulgados. Fale com um corretor para receber a tabela de vendas.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {[...tipologias]
                .sort((a, b) => parseFloat(a.area) - parseFloat(b.area))
                .map((unit) => (
                <Link
                  key={unit.id}
                  href={`/imovel/${unit.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-4 hover:bg-[var(--pill-bg)]"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[unit.tipoUnidade]}</div>
                  <div className="font-serif text-lg font-semibold">{unit.price}</div>
                  <div className="text-xs text-[var(--text-muted)]">{unit.beds} · {unit.parking} · {unit.area}</div>
                  <div className="text-xs text-[var(--text-faint)]">{formatPricePerM2(getAveragePricePerM2([unit]))}</div>
                  <span className="mt-1 text-xs font-semibold text-accent">Ver unidade →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        )}

        <RelatedListings
          title="Imóveis disponíveis neste condomínio"
          items={related.mesmoCondominio}
          emptyText="Nenhum imóvel à venda neste condomínio no momento. Fale com um corretor — avisamos quando surgir uma oportunidade."
        />

        <RelatedListings title="Imóveis à venda nesta região" subtitle={faixaDePreco(related.precoReferencia)} items={related.regiao} />

        <LocationCard
          title={development.name}
          subtitle={development.location}
          mapsQuery={`${development.name}, ${development.location.replace(' — ', ', ')}`}
        />
      </main>

      <Footer />
    </div>
  );
}

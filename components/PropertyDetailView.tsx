import TemporadaBadge from '@/components/TemporadaBadge';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DetailFavoriteButton from '@/components/DetailFavoriteButton';
import PhotoGallery, { type GalleryVideo } from '@/components/PhotoGallery';
import LocationCard from '@/components/LocationCard';
import RichText from '@/components/RichText';
import CollapsibleText from '@/components/CollapsibleText';
import PlantaViewer from '@/components/PlantaViewer';
import ContatoLateral from '@/components/ContatoLateral';
import ContarVisita from '@/components/ContarVisita';
import CondominioTag from '@/components/CondominioTag';
import RelatedListings, { faixaDePreco } from '@/components/RelatedListings';
import { getAveragePricePerM2, formatPricePerM2, type PropertyDetail } from '@/lib/property-details';
import { getDevelopmentById, getRelatedListings } from '@/lib/actions';
import { getStatusBadge } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { getEmbedInfo, getYouTubeAspectRatio } from '@/lib/video-embed';

const BED_PATH = 'M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6 M3 18h18 M5 10V7a2 2 0 0 1 2-2h3v5';

// Visualização do imóvel — Server Component, busca no banco de dados.
export default async function PropertyDetailView({
  property,
  avisoPrivado,
  marcaDagua
}: {
  property: PropertyDetail;
  avisoPrivado?: 'completo' | 'link';
  marcaDagua?: string;
}) {
  const development = property.empreendimentoId ? await getDevelopmentById(property.empreendimentoId) : null;
  const related = await getRelatedListings({ propertyId: property.id }).catch(() => ({ mesmoCondominio: [], regiao: [], precoReferencia: null }));
  const badge = getStatusBadge(property.deliveryDate);
  // Valor do m² da unidade (só venda)
  const precoM2 = property.finalidade === 'venda' ? getAveragePricePerM2([property]) || null : null;
  const embed = property.videoUrl ? getEmbedInfo(property.videoUrl) : null;

  // Descobre o formato real do vídeo (horizontal ou vertical) pra evitar
  // tanto tarja preta quanto corte — o quadro nasce do tamanho certo pro
  // vídeo, em vez de forçar um formato fixo. Só existe pra YouTube (o
  // Instagram não expõe essa informação do mesmo jeito).
  const youtubeAspect = embed?.platform === 'youtube' ? await getYouTubeAspectRatio(embed.videoId) : null;
  const galleryVideo: GalleryVideo | null = embed
    ? { embedUrl: embed.embedUrl, platform: embed.platform, ratio: property.videoVertical ? 9 / 16 : youtubeAspect ? youtubeAspect.width / youtubeAspect.height : undefined }
    : null;

  const photos = property.photos ?? [];
  // Galeria no topo: com vídeo, ele ocupa o lugar da foto principal (tocando
  // sozinho, sem som); sem vídeo, a foto de capa ocupa esse lugar. Sem fotos
  // nem vídeo, fica só o espaço reservado.
  const hasGallery = photos.length > 0 || !!galleryVideo;
  const showMediaBlock = !hasGallery;
  const nomeCondominio = property.condominio || development?.name;
  const regiao = property.location.replace(' — ', ', ');
  const titulo = property.titulo || `${TIPO_UNIDADE_LABEL[property.tipoUnidade]} em ${property.location}`;

  const badges = (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {badge.text}
                </span>
                {property.finalidade === 'aluguel' && (
                  <span className="rounded-md bg-ink/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    Aluguel
                  </span>
                )}
                {property.aceitaTemporada && (
                  <TemporadaBadge grande />
                )}
              </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <ContarVisita tipo="imovel" id={property.id} />

      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Voltar para a Home
        </Link>

        {avisoPrivado && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--pill-bg)] p-4 text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            <span>
              {avisoPrivado === 'link' ? (
                <>
                  <strong>Anúncio exclusivo.</strong> Este link foi liberado só para você e só abre neste aparelho. Quer mostrar para outra pessoa? Peça ao
                  nosso atendimento — enviamos um link para o telefone dela.
                </>
              ) : (
                <>
                  <strong>Anúncio privado</strong> — só a equipe e quem recebe o link privado veem esta página completa. O público vê só o resumo.
                </>
              )}
            </span>
          </div>
        )}
        <h1 className="font-serif text-2xl font-semibold">{titulo}</h1>
        {nomeCondominio && (
          <div className="mt-2">
            {development ? (
              <Link href={`/empreendimento/${development.id}`} className="inline-flex items-center gap-1.5 hover:opacity-80" title="Ver o condomínio">
                <CondominioTag nome={nomeCondominio} grande />
                <span className="text-sm font-semibold text-accent">Ver condomínio →</span>
              </Link>
            ) : (
              <CondominioTag nome={nomeCondominio} grande />
            )}
          </div>
        )}
        <p className="mb-5 mt-1.5 text-sm text-[var(--text-muted)]">{property.location}</p>

        {property.vendidoEm && (
          <p className="mb-4 rounded-xl p-3 text-sm font-semibold text-white" style={{ background: '#e62f2f' }}>
            Este imóvel foi vendido. Veja abaixo opções parecidas na mesma região — ou fale conosco que encontramos outro para você.
          </p>
        )}
        {hasGallery && (
          <section aria-label="Fotos e vídeo do imóvel" className="mb-8">
            <PhotoGallery photos={photos} video={galleryVideo} alt={titulo} badges={badges} vendido={!!property.vendidoEm} marcaDagua={marcaDagua} />
          </section>
        )}

        <div className="grid gap-8 md:grid-cols-[1.3fr_1fr]">
          <div>
            {showMediaBlock && (
            <div
              className={`relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[var(--card-img-bg)] ${
                property.video && !embed ? 'video-playing' : ''
              }`}
              style={{ height: 360 }}
            >
              <span className="text-sm text-[var(--text-faint)]">{property.video ? '[CAPA EM VÍDEO]' : '[FOTO]'}</span>
              {property.videoUrl && !embed && (
                <a
                  href={property.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute bottom-3 right-3 rounded-md bg-ink/70 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink"
                >
                  Assistir vídeo ↗
                </a>
              )}
              <div className="absolute left-3 top-3">{badges}</div>
            </div>
            )}

            {property.plantas && property.plantas.length > 0 && (
              <section className={showMediaBlock ? 'mt-6' : ''} aria-label="Planta do imóvel">
                <h2 className="mb-3 text-lg font-bold">{property.plantas.length > 1 ? 'Plantas' : 'Planta'}</h2>
                <PlantaViewer plantas={property.plantas} titulo={titulo} />
              </section>
            )}

            <div className={showMediaBlock || property.plantas?.length ? 'mt-6' : ''}>
              <h2 className="mb-2 text-lg font-bold">Sobre o imóvel</h2>
              <CollapsibleText>
                <RichText texto={property.description} />
              </CollapsibleText>
            </div>

            <div className="mt-6">
              <h2 className="mb-3 text-lg font-bold">O que tem no condomínio</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {property.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            {development && (
              <div className="mt-6 rounded-xl border border-[var(--border)] p-4">
                <h2 className="text-base font-bold">Fica no {development.name}</h2>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">Veja lazer, tipologias e todos os imóveis disponíveis neste condomínio.</p>
                <Link href={`/empreendimento/${development.id}`} className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
                  Ver o condomínio →
                </Link>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-5">
            <div className="rounded-2xl border border-[var(--border)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[property.tipoUnidade]}</div>
              <div className="font-sans tabular-nums text-2xl font-bold tracking-tight">{property.price}</div>
              {precoM2 && <div className="text-sm text-[var(--text-muted)]">{formatPricePerM2(precoM2)}</div>}
              <div className="mt-1 text-sm text-[var(--text-muted)]">{property.location}</div>

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-4">
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={BED_PATH} />
                  </svg>
                  {property.beds}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  {property.parking}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h7v7H3z" />
                    <path d="M14 14h7v7h-7z" />
                    <path d="M10 6.5h4" />
                    <path d="M17.5 10v4" />
                  </svg>
                  {property.area}
                </span>
                {property.banheiros && (
                  <span className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12h16 M6 12V6a2 2 0 0 1 2-2h1 M6 20v-2 M18 20v-2" />
                    </svg>
                    {property.banheiros}
                  </span>
                )}
              </div>

              <div className="mt-5">
                <DetailFavoriteButton propertyId={property.id} />
              </div>
            </div>

            <div className="md:sticky md:top-24">
              <ContatoLateral
                titulo="Falar com um corretor"
                condominio={nomeCondominio || titulo}
                developmentId={property.empreendimentoId}
                referencia={`${titulo} — /imovel/${property.id}`}
                mensagemInicial={`Olá! Tenho interesse neste imóvel: ${titulo}. Ainda está disponível?`}
              />
            </div>
          </aside>
        </div>
        <RelatedListings
          title={nomeCondominio ? `Outros à venda no ${nomeCondominio}` : 'Outros à venda neste condomínio'}
          items={related.mesmoCondominio.filter((p) => p.finalidade === 'venda')}
        />
        <RelatedListings
          title={nomeCondominio ? `Para alugar no ${nomeCondominio}` : 'Para alugar neste condomínio'}
          items={related.mesmoCondominio.filter((p) => p.finalidade === 'aluguel')}
        />

        <RelatedListings
          title={`Imóveis ${property.finalidade === 'aluguel' ? 'para alugar' : 'à venda'} nesta região`}
          subtitle={faixaDePreco(related.precoReferencia)}
          items={related.regiao}
        />

        <LocationCard
          title={nomeCondominio || property.bairro || property.location.split(',')[0]}
          subtitle={property.location}
          mapsQuery={nomeCondominio ? `${nomeCondominio}, ${regiao}` : regiao}
          approximate={!nomeCondominio}
        />
      </main>

      <Footer />
    </div>
  );
}

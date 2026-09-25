import TemporadaBadge from '@/components/TemporadaBadge';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PhotoGallery, { type GalleryVideo } from '@/components/PhotoGallery';
import LocationCard from '@/components/LocationCard';
import RichText from '@/components/RichText';
import InterestForm from '@/components/InterestForm';
import CollapsibleText from '@/components/CollapsibleText';
import PlantaViewer from '@/components/PlantaViewer';
import ContatoLateral from '@/components/ContatoLateral';
import RelatedListings, { faixaDePreco } from '@/components/RelatedListings';
import { getRelatedListings, getOcultosDoCondominio } from '@/lib/actions';
import OcultoCard from '@/components/OcultoCard';
import { getAveragePricePerM2, formatPricePerM2, type Development } from '@/lib/property-details';
import { getBadgeCondominio } from '@/lib/classification';
import { getEmbedInfo, getYouTubeAspectRatio } from '@/lib/video-embed';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import ContarVisita from '@/components/ContarVisita';
import Trilha from '@/components/Trilha';
import BarraEquipe from '@/components/BarraEquipe';
import BotaoWhatsapp from '@/components/BotaoWhatsapp';
import { trilhaDoImovel } from '@/lib/seo';
import { urlImovel, urlCondominio } from '@/lib/urls';

function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default async function DevelopmentDetailView({ development }: { development: Development }) {
  const badge = getBadgeCondominio(development.deliveryDate, development.tipo);
  const tipologias = development.units.filter((u) => u.isTipologia);
  const related = await getRelatedListings({ developmentId: development.id }).catch(() => ({ mesmoCondominio: [], regiao: [], precoReferencia: null }));
  const futuro = !!development.deliveryDate && badge.bucket === 'lancamento';
  const reservados = await getOcultosDoCondominio(development.id, development.name, development.cidade).catch(() => []);
  const embed = development.videoUrl ? getEmbedInfo(development.videoUrl) : null;
  // Preço médio do m² vem só da tabela de vendas (tipologias), não dos imóveis de revenda
  const avgPricePerM2 = getAveragePricePerM2(development.units.filter((u) => u.isTipologia));
  const precosTabela = development.units.filter((u) => u.isTipologia && u.priceValue).map((u) => u.priceValue as number);
  const precoInicial = precosTabela.length ? Math.min(...precosTabela) : null;
  // Lançamento ou entregue há menos de 1 ano: ainda tem venda direta da incorporadora,
  // então no lugar do "Registre seu interesse" vai o convite para falar conosco.
  const entregueHaMeses = development.deliveryDate
    ? (Date.now() - new Date(`${development.deliveryDate}-01T00:00:00`).getTime()) / (1000 * 60 * 60 * 24 * 30.4)
    : null;
  // WhatsApp da Leyde: condomínios lançamento, novo ou seminovo (entregues há até 6 anos)
  const recente = !!development.deliveryDate && new Date(`${development.deliveryDate}-01T00:00:00`).getTime() > Date.now() - 6 * 365.25 * 864e5;
  const whats = recente
    ? { titulo: `${development.name}, ${[development.bairro, development.cidade].filter(Boolean).join(', ') || development.location}`, caminho: urlCondominio(development), condominio: development.name, developmentId: development.id }
    : null;
  const vendaDireta = futuro || (entregueHaMeses != null && entregueHaMeses <= 12);

  const youtubeAspect = embed?.platform === 'youtube' ? await getYouTubeAspectRatio(embed.videoId) : null;
  const galleryVideo: GalleryVideo | null = embed
    ? { embedUrl: embed.embedUrl, platform: embed.platform, ratio: development.videoVertical ? 9 / 16 : youtubeAspect ? youtubeAspect.width / youtubeAspect.height : undefined }
    : null;

  const photos = development.photos ?? [];
  // Com vídeo, ele ocupa o lugar da foto principal da galeria; sem vídeo, a foto de capa.
  const hasGallery = photos.length > 0 || !!galleryVideo;
  // Sem foto nem vídeo: a página começa direto pelo nome (sem espaço de foto vazio)
  const showMediaBlock = false;
  // Tipos e quartos do CONDOMÍNIO: o que foi marcado no cadastro dele + a tabela de vendas.
  // Os imóveis anunciados (revenda/aluguel) aparecem na seção deles, sem mudar isso.
  const tabela = development.units.filter((u) => u.isTipologia);
  const tipos = Array.from(new Set([...(development.tiposUnidade ?? []), ...tabela.map((u) => u.tipoUnidade)]));
  const quartosConhecidos = Array.from(
    new Set([...(development.quartosOpcoes ?? []), ...tabela.map((u) => parseInt(u.beds, 10)).filter((n) => Number.isFinite(n))])
  ).sort((a, b) => a - b);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {whats && <BotaoWhatsapp ctx={whats} variante="flutuante" />}
      <ContarVisita tipo="empreendimento" id={development.id} perfil={{ tipos: development.tiposUnidade ?? [], bairros: development.bairro ? [development.bairro] : [] }} />

      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <BarraEquipe tipo="condominio" id={development.id} />
        <Trilha itens={trilhaDoImovel({ uf: development.uf, cidade: development.cidade, bairro: development.bairro })} />

        {development.status === 'rascunho' && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <span>
              <strong>Rascunho: não aparece no site.</strong> Só a equipe logada vê esta página.
            </span>
            <Link href={`/dashboard/condominios/${development.id}/editar`} className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white">
              Finalizar e publicar
            </Link>
          </div>
        )}

        {hasGallery && (
          <section aria-label="Fotos do empreendimento" className={showMediaBlock ? 'mb-6' : ''}>
            <PhotoGallery
              photos={photos}
              video={galleryVideo}
              alt={`${development.name}, ${development.tipo === 'horizontal' ? 'condomínio de casas' : 'edifício'} em ${[development.bairro, development.cidade].filter(Boolean).join(', ') || development.location} | Mais Novos Imóveis`}
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
              <TemporadaBadge grande />
            )}
          </div>
        </div>
        )}

        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
        <div className={`${hasGallery ? 'mt-6' : 'mt-2'} flex flex-col gap-1`}>
          {!hasGallery && (
            <span className="mb-1 w-fit rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide" style={{ background: badge.bg, color: badge.color }}>
              {badge.text}
            </span>
          )}
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

        {development.description?.trim() && (
          <div className="mt-5">
            <h2 className="mb-2 text-lg font-bold">Sobre o empreendimento</h2>
            <CollapsibleText>
              <RichText texto={development.description} />
            </CollapsibleText>
          </div>
        )}

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
        </div>

        {/* Lateral direita: resumo + Fale conosco (fica fixa ao rolar no computador) */}
        <aside className={`${hasGallery ? 'md:mt-6' : ''} flex flex-col gap-4`}>
          <div className="flex flex-col gap-4 md:sticky md:top-24">
            {(precoInicial || avgPricePerM2 > 0 || development.deliveryDate) && (
              <div className="rounded-2xl border border-[var(--border)] p-5">
                {precoInicial ? (
                  <>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Unidades a partir de</div>
                    <div className="font-sans text-2xl font-bold tabular-nums tracking-tight">{formatBRL(precoInicial)}</div>
                  </>
                ) : (
                  <div className="text-sm font-semibold">Valores sob consulta</div>
                )}
                {avgPricePerM2 > 0 && <div className="mt-1 text-sm text-[var(--text-muted)]">Média de {formatPricePerM2(avgPricePerM2)}</div>}
                <div className="mt-3 border-t border-[var(--border)] pt-3 text-sm font-semibold text-accent">{development.deliveryNote}</div>
              </div>
            )}
            <ContatoLateral
              condominio={development.name}
              developmentId={development.id}
              referencia={`Condomínio ${development.name} · ${urlCondominio(development)}`}
              mensagemInicial={`Olá! Quero saber mais sobre o ${development.name}: valores e unidades disponíveis.`}
              whatsapp={whats ?? undefined}
            />
          </div>
        </aside>
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
                .sort((a, b) => (a.areaValue ?? parseFloat(a.area)) - (b.areaValue ?? parseFloat(b.area)))
                .map((unit) => (
                <div key={unit.id} className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)]">
                {unit.plantas && unit.plantas.length > 0 && (
                  <div className="border-b border-[var(--border)] p-2">
                    <PlantaViewer
                      compacta
                      plantas={unit.plantas}
                      titulo={`${TIPO_UNIDADE_LABEL[unit.tipoUnidade]} de ${unit.area} no ${development.name}`}
                    />
                  </div>
                )}
                <Link
                  href={urlImovel(unit)}
                  className="flex flex-1 flex-col gap-2 p-4 hover:bg-[var(--pill-bg)]"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[unit.tipoUnidade]}</div>
                  <div className="font-sans tabular-nums text-lg font-bold tracking-tight">{unit.price}</div>
                  <div className="text-xs text-[var(--text-muted)]">{unit.beds} · {unit.parking} · {unit.area}</div>
                  <div className="text-xs text-[var(--text-faint)]">{formatPricePerM2(getAveragePricePerM2([unit]))}</div>
                  <span className="mt-1 text-xs font-semibold text-accent">Ver unidade →</span>
                </Link>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        <RelatedListings
          title={`À venda no ${development.name}`}
          items={related.mesmoCondominio.filter((p) => p.finalidade === 'venda')}
          emptyText={vendaDireta ? `Nenhum anúncio particular no ${development.name} no momento. Fale conosco para ver as unidades direto com a incorporadora.` : `Nenhum imóvel à venda no ${development.name} no momento — registre seu interesse abaixo e avisamos quando surgir uma oportunidade.`}
        />
        {reservados.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold">Imóveis reservados no {development.name}</h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              Anúncios do nosso portfólio que não estão públicos a pedido do proprietário. Peça para ver e verificamos a disponibilidade.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {reservados.map((a) => (
                <OcultoCard key={a.id} a={a} />
              ))}
            </div>
          </section>
        )}
        <RelatedListings title={`Para alugar no ${development.name}`} items={related.mesmoCondominio.filter((p) => p.finalidade === 'aluguel')} />

        {vendaDireta ? (
          <section className="mt-10 flex flex-col items-start gap-3 rounded-2xl border border-accent/40 bg-[#f5f8ff] p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div>
              <h2 className="font-serif text-xl font-semibold">Quer comprar uma unidade no {development.name}?</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Fale conosco e verifique as disponibilidades particulares e direto pela incorporadora.</p>
            </div>
            <a href="#fale-conosco" className="shrink-0 rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hover:opacity-90">
              Fale conosco
            </a>
          </section>
        ) : (
          <InterestForm developmentId={development.id} condominio={development.name} destaque={related.mesmoCondominio.length === 0} />
        )}

        <RelatedListings title="Imóveis à venda nesta região" subtitle={faixaDePreco(related.precoReferencia)} items={related.regiao} />

        <LocationCard
          title={development.name}
          subtitle={development.location}
          mapsQuery={`${development.name}, ${development.location.replace(/\s*—\s*/g, ', ')}`}
        />
      </main>

      <Footer />
    </div>
  );
}

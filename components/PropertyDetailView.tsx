import TemporadaBadge from '@/components/TemporadaBadge';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PhotoGallery, { type GalleryVideo } from '@/components/PhotoGallery';
import RichText from '@/components/RichText';
import CollapsibleText from '@/components/CollapsibleText';
import PlantaViewer from '@/components/PlantaViewer';
import ContatoLateral from '@/components/ContatoLateral';
import CorretorSelo from '@/components/CorretorSelo';
import { numeroDe } from '@/components/IconesImovel';
import ContarVisita from '@/components/ContarVisita';
import CondominioTag from '@/components/CondominioTag';
import Trilha from '@/components/Trilha';
import BarraEquipe from '@/components/BarraEquipe';
import { altFoto, nomeCondominioSeo, trilhaDoImovel, tituloSeoImovel } from '@/lib/seo';
import RelatedListings, { faixaDePreco } from '@/components/RelatedListings';
import { getAveragePricePerM2, formatPricePerM2, type PropertyDetail } from '@/lib/property-details';
import { getDevelopmentById, getOcultosDoCondominio, getOcultosPerto, getRelatedListings, lancamentosProximos, mercadoDoBairro } from '@/lib/actions';
import BannerFundadora from '@/components/news/BannerFundadora';
import VitrineNews from '@/components/news/VitrineNews';
import { SITE_URL } from '@/lib/seo';
import BotaoCompartilhar from '@/components/BotaoCompartilhar';
import ChamadaAvaliar from '@/components/ChamadaAvaliar';
import InterestForm from '@/components/InterestForm';
import DetailFavoriteButton from '@/components/DetailFavoriteButton';
import { Banner } from '@/components/news/Pecas';
import { bannersAtivos } from '@/lib/news/dados';
import { SecaoCondominios, BarraContatoFixa, CaixaPreco, CardRegiao, ChipsPerfil, EspacoBarra, SecaoPrivados, TituloPerfil, brl, textoEntrega, type Chip } from '@/components/perfil/BlocosPerfil';
import { getStatusBadge } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { getEmbedInfo, getYouTubeAspectRatio } from '@/lib/video-embed';
import { urlImovel, urlCondominio } from '@/lib/urls';

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

  // WhatsApp da Leyde com o link deste anúncio (vale para todos os anúncios)
  const whats = { titulo: tituloSeoImovel(property), caminho: urlImovel(property), condominio: nomeCondominio, developmentId: property.empreendimentoId };

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

  const [mercado, privados, banners, novosPerto] = await Promise.all([
    mercadoDoBairro(property.cidade, property.bairro).catch(() => null),
    nomeCondominio ? getOcultosDoCondominio(development?.id ?? '', nomeCondominio, property.cidade).catch(() => []) : Promise.resolve([]),
    bannersAtivos(),
    property.finalidade === 'venda' ? lancamentosProximos({ propertyId: property.id }, 8).catch(() => []) : Promise.resolve([])
  ]);
  const outrosPrivados = privados.filter((a) => a.id !== property.id);
  const privadosPerto = property.visibilidade !== 'privado' ? await getOcultosPerto({ propertyId: property.id }, outrosPrivados.map((a) => a.id), 6).catch(() => []) : [];
  const entrega = textoEntrega(property.deliveryDate);
  const q = numeroDe(property.beds);
  const ban = numeroDe(property.banheiros);
  const vg = numeroDe(property.parking);
  const chips: Chip[] = [
    ...(entrega ? [{ texto: entrega, tipo: 'entrega' as const }] : []),
    { texto: badge.text, tipo: 'fase', bg: badge.bg, cor: badge.color },
    ...(property.area !== '-' ? [{ texto: `${property.area} privativos` }] : []),
    ...(q ? [{ texto: `${q} ${q === 1 ? 'quarto' : 'quartos'}` }] : []),
    ...(ban ? [{ texto: `${ban} ${ban === 1 ? 'banheiro' : 'banheiros'}` }] : []),
    ...(vg ? [{ texto: `${vg} ${vg === 1 ? 'vaga' : 'vagas'}` }] : []),
    ...(property.areaTotal ? [{ texto: `${property.areaTotal.toLocaleString('pt-BR')} m² total` }] : []),
    ...(property.areaLote ? [{ texto: `Lote ${property.areaLote.toLocaleString('pt-BR')} m²` }] : [])
  ];
  const aVenda = related.mesmoCondominio.filter((p) => p.finalidade === 'venda');

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <ContarVisita tipo="imovel" id={property.id} perfil={{ tipos: [property.tipoUnidade], bairros: property.bairro ? [property.bairro] : [], preco: property.finalidade === 'venda' ? property.priceValue : null }} />

      <main className="mx-auto w-full max-w-6xl px-5 pb-10 pt-6 md:px-8">
        <BarraEquipe tipo="imovel" id={property.id} />
        <Trilha itens={trilhaDoImovel({ uf: property.uf, cidade: property.cidade, bairro: property.bairro }, development && development.status !== 'rascunho' ? development : null)} />

        {avisoPrivado && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--pill-bg)] p-4 text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            <span>
              {avisoPrivado === 'link' ? (
                <>
                  <strong>Anúncio exclusivo.</strong> Este link foi liberado só para você e só abre neste aparelho. Quer mostrar para outra pessoa? Peça ao
                  nosso atendimento: enviamos um link para o telefone dela.
                </>
              ) : (
                <>
                  <strong>Anúncio privado:</strong> só a equipe e quem recebe o link privado veem esta página completa. O público vê só o resumo.
                </>
              )}
            </span>
          </div>
        )}

        <TituloPerfil
          titulo={titulo}
          acoes={
            <>
              <DetailFavoriteButton propertyId={property.id} icone />
              <BotaoCompartilhar url={`${SITE_URL}${urlImovel(property)}`} titulo={titulo} refId={property.id} />
            </>
          }
          endereco={property.location}
          extra={
            nomeCondominio ? (
              development && development.status !== 'rascunho' ? (
                <Link href={urlCondominio(development)} className="inline-flex items-center gap-1.5 hover:opacity-80" title="Ver o condomínio">
                  <CondominioTag nome={nomeCondominio} grande />
                  <span className="text-sm font-semibold text-accent">Ver condomínio →</span>
                </Link>
              ) : (
                <CondominioTag nome={nomeCondominio} grande />
              )
            ) : null
          }
        />

        {property.vendidoEm && (
          <p className="mb-4 rounded-xl p-3 text-sm font-semibold text-white" style={{ background: '#e62f2f' }}>
            Este imóvel foi vendido. Veja abaixo opções parecidas na mesma região ou fale conosco que encontramos outro para você.
          </p>
        )}

        {hasGallery && (
          <section aria-label="Fotos e vídeo do imóvel">
            <PhotoGallery photos={photos} video={galleryVideo} alt={altFoto(property)} badges={badges} vendido={!!property.vendidoEm} marcaDagua={marcaDagua} />
          </section>
        )}

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {/* preço primeiro; entrega, metragens e características logo ABAIXO do preço */}
            <CaixaPreco
              rotulo={property.vendidoEm ? 'Vendido' : property.finalidade === 'aluguel' ? 'Aluguel' : TIPO_UNIDADE_LABEL[property.tipoUnidade] + ' à venda'}
              preco={property.priceValue ? property.price : null}
              apoio={precoM2 ? `${formatPricePerM2(precoM2)} neste imóvel` : null}
              mercado={property.finalidade === 'venda' ? mercado : null}
            />
            <ChipsPerfil chips={chips} />

            {property.plantas && property.plantas.length > 0 && (
              <section className="mt-6" aria-label="Planta do imóvel">
                <h2 className="mb-3 text-lg font-bold">{property.plantas.length > 1 ? 'Plantas' : 'Planta'}</h2>
                <PlantaViewer plantas={property.plantas} titulo={titulo} />
              </section>
            )}

            {property.description?.trim() && (
              <div className="mt-8 rounded-[20px] border border-black/[0.06] p-5 md:p-7">
                <h2 className="font-serif text-[21px] font-semibold tracking-tight">Sobre o imóvel</h2>
                <p className="mt-1 text-[13px] font-medium text-[var(--text-muted)]">
                  {[`${TIPO_UNIDADE_LABEL[property.tipoUnidade]} ${property.finalidade === 'aluguel' ? 'para alugar' : 'à venda'}${nomeCondominio ? ` no ${nomeCondominio}` : ''}`, property.bairro, entrega]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="mt-4">
                  <CollapsibleText maxHeight={170}>
                    <RichText texto={property.description} />
                  </CollapsibleText>
                </div>
              </div>
            )}

            {property.amenities.length > 0 && (
              <div className="mt-8">
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
            )}

            {development && development.status !== 'rascunho' && (
              <div className="mt-8 rounded-[20px] border border-[var(--border)] p-5">
                <h2 className="text-base font-bold">Fica no {development.name}</h2>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">Veja lazer, tipologias e todos os imóveis disponíveis neste condomínio.</p>
                <Link href={urlCondominio(development)} className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
                  Ver o condomínio →
                </Link>
              </div>
            )}

            <ChamadaAvaliar contexto="imovel" refId={property.id} />
          </div>

          {/* coluna da direita: região, contato e o corretor responsável embaixo */}
          <aside className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:sticky lg:top-24">
              <CardRegiao
                titulo={nomeCondominio || property.bairro || property.location.split(',')[0]}
                subtitulo={property.location}
                mapsQuery={nomeCondominio ? `${nomeCondominio}, ${regiao}` : regiao}
                aproximado={!nomeCondominio}
                numeros={[
                  { valor: entrega ? entrega.replace(/^Entrega(ue em)? /, '') : null, rotulo: entrega?.startsWith('Entrega ') ? 'Entrega prevista' : 'Entregue em' },
                  { valor: mercado?.m2Anunciado ? brl(mercado.m2Anunciado) : null, rotulo: `m² médio no ${property.bairro ?? 'bairro'}` },
                  { valor: precoM2 ? brl(precoM2) : null, rotulo: 'm² deste imóvel' }
                ]}
              />
              <ContatoLateral
                titulo="Falar com um corretor"
                condominio={nomeCondominio || titulo}
                developmentId={property.empreendimentoId}
                referencia={`${titulo} · ${urlImovel(property)}`}
                mensagemInicial={`Olá! Tenho interesse neste imóvel: ${titulo}. Ainda está disponível?`}
                whatsapp={whats}
              />
              <BannerFundadora perfil />
              <Banner banners={banners} posicao="perfil" />
              {property.corretor && (
                <div className="flex justify-end rounded-2xl border border-[var(--border)] p-4">
                  <div className="flex flex-col items-end text-right">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">Corretor responsável</div>
                    <CorretorSelo c={property.corretor} grande />
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* privados do mesmo condomínio PRIMEIRO, antes dos anunciados */}
        {nomeCondominio && <SecaoPrivados onde={nomeCondominio} itens={outrosPrivados} />}
        <SecaoPrivados onde={property.bairro ? `do ${property.bairro}` : 'daqui'} itens={privadosPerto} perto />

        <RelatedListings
          grade
          limite={8}
          title={nomeCondominio ? `Outros imóveis à venda no ${nomeCondominioSeo(nomeCondominio)}` : 'Outros imóveis à venda neste condomínio'}
          items={aVenda}
        />
        <RelatedListings
          grade
          limite={8}
          title={nomeCondominio ? `Imóveis para alugar no ${nomeCondominioSeo(nomeCondominio)}` : 'Imóveis para alugar neste condomínio'}
          items={related.mesmoCondominio.filter((p) => p.finalidade === 'aluguel')}
        />
        {property.bairro && (
          <RelatedListings
            grade
            limite={8}
            title={`Imóveis ${property.finalidade === 'aluguel' ? 'para alugar' : 'à venda'} no ${property.bairro}`}
            items={('mesmoBairro' in related && related.mesmoBairro) || []}
          />
        )}
        <RelatedListings grade limite={8} title="Imóveis similares" subtitle={faixaDePreco(related.precoReferencia)} items={related.regiao} />

        {/* lançamentos e novos por perto: venda direta com a incorporadora */}
        <SecaoCondominios
          titulo={`Lançamentos e imóveis novos perto ${property.bairro ? `do ${property.bairro}` : 'daqui'}`}
          subtitulo="Venda direta com a incorporadora, mesmo sem anúncio: fale com a gente e receba tabela e disponibilidade."
          itens={novosPerto.filter((c) => c.id !== property.empreendimentoId)}
        />

        {/* "Avise-me" de imóveis parecidos: no condomínio, até 500 m ou até 2 km */}
        <InterestForm developmentId={property.empreendimentoId} propertyId={property.id} condominio={nomeCondominio || ''} whats={whats} />

        <VitrineNews bairro={property.bairro} cidade={property.cidade} />
      </main>

      <Footer />
      <EspacoBarra />
      <BarraContatoFixa favoritoId={property.id} whats={whats} compartilhar={{ url: `${SITE_URL}${urlImovel(property)}`, titulo, refId: property.id }} />
    </div>
  );
}

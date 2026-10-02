import TemporadaBadge from '@/components/TemporadaBadge';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PhotoGallery, { type GalleryVideo } from '@/components/PhotoGallery';
import RichText from '@/components/RichText';
import InterestForm from '@/components/InterestForm';
import CollapsibleText from '@/components/CollapsibleText';
import PlantaViewer from '@/components/PlantaViewer';
import ContatoLateral from '@/components/ContatoLateral';
import BotaoWhatsapp from '@/components/BotaoWhatsapp';
import RelatedListings, { faixaDePreco } from '@/components/RelatedListings';
import { getRelatedListings, getOcultosDoCondominio, getOcultosPerto, mercadoDoBairro, condominiosProximos, lancamentosProximos } from '@/lib/actions';
import BannerFundadora from '@/components/news/BannerFundadora';
import VitrineNews from '@/components/news/VitrineNews';
import { SITE_URL } from '@/lib/seo';
import BotaoCompartilhar from '@/components/BotaoCompartilhar';
import ChamadaAvaliar from '@/components/ChamadaAvaliar';
import DetailFavoriteButton from '@/components/DetailFavoriteButton';
import { Banner } from '@/components/news/Pecas';
import { bannersAtivos } from '@/lib/news/dados';
import { SecaoCondominios, BarraContatoFixa, CaixaPreco, CardRegiao, ChipsPerfil, EspacoBarra, SecaoPrivados, TituloPerfil, brl, textoEntrega, type Chip } from '@/components/perfil/BlocosPerfil';
import { getAveragePricePerM2, formatPricePerM2, type Development } from '@/lib/property-details';
import { FASES_EXIGEM_CONCEPCAO, ehFutura, getBadgeCondominio, getStatusBucket } from '@/lib/classification';
import { getEmbedInfo, getYouTubeAspectRatio } from '@/lib/video-embed';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import ContarVisita from '@/components/ContarVisita';
import Trilha from '@/components/Trilha';
import BarraEquipe from '@/components/BarraEquipe';
import ConcepcaoBloco from '@/components/ConcepcaoBloco';
import { concepcaoDe } from '@/lib/empresas';
import { nomeCondominioSeo, trilhaDoImovel } from '@/lib/seo';
import { urlImovel, urlCondominio } from '@/lib/urls';

function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default async function DevelopmentDetailView({ development }: { development: Development }) {
  const badge = getBadgeCondominio(development.deliveryDate, development.tipo);
  const tipologias = development.units.filter((u) => u.isTipologia);
  const related = await getRelatedListings({ developmentId: development.id }).catch(() => ({ mesmoCondominio: [], regiao: [], precoReferencia: null }));
  const futuro = !!development.deliveryDate && ehFutura(badge.bucket);
  const concepcao = await concepcaoDe(development.id);
  const reservados = await getOcultosDoCondominio(development.id, development.name, development.cidade).catch(() => []);
  // privados da região (mesmo bairro ou até 2 km, mesmo tipo): também antes dos similares
  const reservadosPerto = development.status !== 'rascunho' ? await getOcultosPerto({ developmentId: development.id }, reservados.map((r) => r.id), 6).catch(() => []) : [];
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
  // WhatsApp da Leyde: condomínios antes da entrega, pronto novo ou seminovo
  const faseAtual = development.deliveryDate ? getStatusBucket(development.deliveryDate) : null;
  const recente = !!faseAtual && FASES_EXIGEM_CONCEPCAO.includes(faseAtual);
  const whats = recente
    ? { titulo: `${development.name}, ${[development.bairro, development.cidade].filter(Boolean).join(', ') || development.location}`, caminho: urlCondominio(development), condominio: development.name, developmentId: development.id }
    : null;
  const vendaDireta = futuro || (entregueHaMeses != null && entregueHaMeses <= 12);
  // "Fale conosco" (barra do rodapé e bloco de venda direta): sempre o WhatsApp de atendimento
  const whatsAtendimento = whats ?? {
    titulo: `${development.name}, ${[development.bairro, development.cidade].filter(Boolean).join(', ') || development.location}`,
    caminho: urlCondominio(development),
    condominio: development.name,
    developmentId: development.id
  };

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
  const qs = [...quartosConhecidos].sort((x, y) => x - y);
  const faixaQuartos = !qs.length ? null : qs.length === 1 ? `${qs[0]}` : qs[qs.length - 1] === qs[0] + 1 ? `${qs[0]} e ${qs[qs.length - 1]}` : `${qs[0]} a ${qs[qs.length - 1]}`;
  const areas = tabela.map((u) => u.areaValue).filter((n): n is number => !!n).sort((x, y) => x - y);
  const faixaArea = !areas.length ? null : Math.round(areas[0]) === Math.round(areas[areas.length - 1]) ? `${Math.round(areas[0])} m²` : `${Math.round(areas[0])} a ${Math.round(areas[areas.length - 1])} m²`;

  const [mercado, banners] = await Promise.all([mercadoDoBairro(development.cidade, development.bairro).catch(() => null), bannersAtivos()]);
  // último caso: poucos anúncios por perto → condomínios vizinhos (pode ter unidade à venda lá)
  const anunciosPerto = new Set([...(('mesmoBairro' in related && related.mesmoBairro) || []), ...related.regiao].filter((x) => !x.vendidoEm).map((x) => x.id)).size;
  // lançamentos, obras e novos por perto: vendidos direto com a incorporadora, mesmo sem anúncio
  const novosPerto = development.status !== 'rascunho' ? await lancamentosProximos({ developmentId: development.id }, 8).catch(() => []) : [];
  const vizinhos =
    anunciosPerto < 4 && development.status !== 'rascunho' ? await condominiosProximos(development.id, 8, novosPerto.map((c) => c.id)).catch(() => []) : [];
  const tipoPlural = development.tipo === 'horizontal' ? 'Casas' : tipos.includes('apartamento') || !tipos.length ? 'Apartamentos' : TIPO_UNIDADE_LABEL[tipos[0]] ?? 'Imóveis';
  const ondeBairro = [development.bairro, development.cidade].filter(Boolean).join(', ') || development.location;
  const entrega = textoEntrega(development.deliveryDate);
  const metragens = Array.from(new Set(areas.map((a) => Math.round(a)))).slice(0, 6);
  const chips: Chip[] = [
    ...(entrega ? [{ texto: entrega, tipo: 'entrega' as const }] : []),
    { texto: badge.text, tipo: 'fase', bg: badge.bg, cor: badge.color },
    ...(metragens.length ? metragens.map((m) => ({ texto: `${m} m²` })) : faixaArea ? [{ texto: faixaArea }] : []),
    ...(faixaQuartos ? [{ texto: `${faixaQuartos} ${qs[qs.length - 1] === 1 ? 'quarto' : 'quartos'}` }] : []),
    ...(development.pavimentos ? [{ texto: `${development.pavimentos} pavimentos` }] : [])
  ];
  const aVenda = related.mesmoCondominio.filter((p) => p.finalidade === 'venda');
  // Novo/seminovo/usado sem nenhuma unidade à venda e sem preço: avisa de leve e sobe os
  // imóveis do bairro e os similares para logo abaixo do condomínio (antes do cadastro)
  const semUnidade = !futuro && !precoInicial && aVenda.filter((x) => !x.vendidoEm).length === 0;
  const secoesParecidos = (
    <div id="parecidos" className="scroll-mt-24">
      {development.bairro && (
        <RelatedListings grade limite={8} title={`Imóveis à venda no ${development.bairro}`} items={('mesmoBairro' in related && related.mesmoBairro) || []} />
      )}
      <RelatedListings grade limite={8} title={`Imóveis similares perto do ${development.name}`} subtitle={faixaDePreco(related.precoReferencia)} items={related.regiao} />
      <SecaoCondominios
        titulo={`Lançamentos e imóveis novos perto do ${development.name}`}
        subtitulo="Venda direta com a incorporadora, mesmo sem anúncio: fale com a gente e receba tabela e disponibilidade."
        itens={novosPerto}
      />
      <SecaoCondominios
        titulo="Pode ser que tenha imóveis à venda nesses condomínios próximos"
        subtitulo={`${development.tipo === 'horizontal' ? 'Condomínios de casas' : 'Condomínios'} perto do ${development.name}. Muitas unidades são vendidas sem anúncio: fale com a gente e verificamos.`}
        itens={vizinhos}
      />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <ContarVisita tipo="empreendimento" id={development.id} perfil={{ tipos: development.tiposUnidade ?? [], bairros: development.bairro ? [development.bairro] : [] }} />

      <main className="mx-auto w-full max-w-6xl px-5 pb-10 pt-6 md:px-8">
        <BarraEquipe tipo="condominio" id={development.id} />
        <Trilha itens={trilhaDoImovel({ uf: development.uf, cidade: development.cidade, bairro: development.bairro }, development)} />

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

        <TituloPerfil
          titulo={development.name}
          acoes={
            development.status !== 'rascunho' ? (
              <>
                <DetailFavoriteButton propertyId={development.id} rotulo="empreendimento" icone />
                <BotaoCompartilhar url={`${SITE_URL}${urlCondominio(development)}`} titulo={development.name} refId={development.id} />
              </>
            ) : null
          }
          subtitulo={`${tipoPlural} à venda no ${ondeBairro}`}
          endereco={[development.bairro, [development.cidade, development.uf].filter(Boolean).join('/')].filter(Boolean).join(', ') || development.location}
        />

        {hasGallery && (
          <section aria-label="Fotos do empreendimento">
            <PhotoGallery
              photos={photos}
              video={galleryVideo}
              alt={`${development.name}, ${development.tipo === 'horizontal' ? 'condomínio de casas' : 'edifício'} em ${ondeBairro} | Mais Novos Imóveis`}
              badges={
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide" style={{ background: badge.bg, color: badge.color }}>
                    {badge.text}
                  </span>
                  {development.aceitaTemporada && <TemporadaBadge grande />}
                </div>
              }
            />
          </section>
        )}

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {/* preço primeiro; entrega e metragens logo ABAIXO do preço */}
            <CaixaPreco
              rotulo={precoInicial ? 'Valores a partir de' : 'Valores'}
              preco={precoInicial ? brl(precoInicial) : null}
              apoio={avgPricePerM2 > 0 ? `Média de ${formatPricePerM2(avgPricePerM2)} na tabela de vendas` : tabela.length ? `${tabela.length} tipologia(s)` : null}
              mercado={mercado}
            />
            <ChipsPerfil chips={chips} />
            {semUnidade && (
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[var(--pill-bg)] px-4 py-2.5 text-[13px]">
                <span className="font-semibold">Por enquanto, nenhuma unidade à venda neste condomínio.</span>
                <a href="#parecidos" className="font-semibold text-accent hover:underline">
                  Ver imóveis parecidos na região ↓
                </a>
              </p>
            )}

            {(tipologias.length > 0 || futuro) && (
              <div className="mt-6">
                <h2 className="mb-3 text-lg font-bold">{tipologias.length > 0 ? 'Tipologias' : 'Tipologias em breve'}</h2>
                {tipologias.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">As metragens e valores de cada tipologia ainda não foram divulgados. Fale com um corretor para receber a tabela de vendas.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {[...tipologias]
                      .sort((a, b) => (a.areaValue ?? parseFloat(a.area)) - (b.areaValue ?? parseFloat(b.area)))
                      .map((unit) => (
                        <div key={unit.id} className="flex flex-col overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--bg)]">
                          {unit.plantas && unit.plantas.length > 0 && (
                            <div className="border-b border-[var(--border)] p-2">
                              <PlantaViewer compacta plantas={unit.plantas} titulo={`${TIPO_UNIDADE_LABEL[unit.tipoUnidade]} de ${unit.area} no ${development.name}`} />
                            </div>
                          )}
                          <Link href={urlImovel(unit)} className="flex flex-1 flex-col gap-1 p-4 hover:bg-[var(--pill-bg)]">
                            <div className="text-[18px] font-bold leading-tight">{unit.area}</div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {unit.beds} · {unit.parking}
                            </div>
                            <div className="mt-1.5 font-sans text-[15px] font-bold tabular-nums text-accent">{unit.price}</div>
                            <div className="text-[11px] text-[var(--text-faint)]">{formatPricePerM2(getAveragePricePerM2([unit]))}</div>
                          </Link>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            <ConcepcaoBloco itens={concepcao} />

            {tipos.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">Tipos de imóvel</span>
                {tipos.map((t) => (
                  <span key={t} className="rounded-full bg-[var(--pill-bg)] px-3 py-1 text-xs font-semibold">
                    {TIPO_UNIDADE_LABEL[t]}
                  </span>
                ))}
                <span className="rounded-full bg-[var(--pill-bg)] px-3 py-1 text-xs font-semibold">{development.tipo === 'vertical' ? 'Condomínio vertical' : 'Condomínio horizontal'}</span>
                {development.areaTerreno && <span className="rounded-full bg-[var(--pill-bg)] px-3 py-1 text-xs font-semibold">Terreno de {development.areaTerreno}</span>}
              </div>
            )}

            {development.description?.trim() && (
              <div className="mt-8 rounded-[20px] border border-black/[0.06] p-5 md:p-7">
                <h2 className="font-serif text-[21px] font-semibold tracking-tight">Sobre o {development.name}</h2>
                <p className="mt-1 text-[13px] font-medium text-[var(--text-muted)]">
                  {[`${tipoPlural} à venda no ${development.bairro || development.cidade || ''}`, entrega].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-4">
                  <CollapsibleText maxHeight={170}>
                    <RichText texto={development.description} />
                  </CollapsibleText>
                </div>
              </div>
            )}

            {development.amenities.length > 0 && (
              <div className="mt-8">
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
            )}

            <ChamadaAvaliar contexto={futuro ? 'lancamento' : 'condominio'} refId={development.id} />
          </div>

          {/* coluna da direita: região (mapa + números) e contato; fica fixa ao rolar no computador */}
          <aside className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:sticky lg:top-24">
              <CardRegiao
                titulo={development.name}
                subtitulo={development.location}
                mapsQuery={`${development.name}, ${development.location.replace(/\s*—\s*/g, ', ')}`}
                numeros={[
                  { valor: entrega ? entrega.replace(/^Entrega(ue em)? /, '') : null, rotulo: futuro ? 'Entrega prevista' : 'Entregue em' },
                  { valor: mercado?.m2Anunciado ? brl(mercado.m2Anunciado) : null, rotulo: `m² médio no ${development.bairro ?? 'bairro'}` },
                  { valor: aVenda.length ? String(aVenda.filter((x) => !x.vendidoEm).length) : tabela.length ? String(tabela.length) : null, rotulo: aVenda.length ? 'à venda aqui' : 'tipologias' }
                ]}
              />
              <ContatoLateral
                condominio={development.name}
                developmentId={development.id}
                referencia={`Condomínio ${development.name} · ${urlCondominio(development)}`}
                mensagemInicial={`Olá! Quero saber mais sobre o ${development.name}: valores e unidades disponíveis.`}
                whatsapp={whatsAtendimento}
              />
              <BannerFundadora perfil />
              <Banner banners={banners} posicao="perfil" />
            </div>
          </aside>
        </div>

        {/* privados PRIMEIRO: do condomínio e da região, antes de anunciados e similares */}
        <SecaoPrivados onde={development.name} itens={reservados} />
        <SecaoPrivados onde={`do ${development.name}`} itens={reservadosPerto} perto />

        {/* sem unidade à venda: parecidos logo abaixo dos privados */}
        {semUnidade && secoesParecidos}

        {!semUnidade && (
        <RelatedListings
          grade
          limite={8}
          title={`Imóveis à venda no ${nomeCondominioSeo(development.name)}`}
          subtitle={aVenda.length ? `${aVenda.length} anúncio(s) neste condomínio` : undefined}
          items={aVenda}
          emptyText={
            vendaDireta
              ? `Nenhum anúncio particular no ${development.name} no momento. Fale conosco para ver as unidades direto com a incorporadora.`
              : `Nenhum imóvel à venda no ${development.name} no momento. Registre seu interesse abaixo e avisamos quando surgir uma oportunidade.`
          }
        />
        )}
        <RelatedListings grade limite={8} title={`Para alugar no ${development.name}`} items={related.mesmoCondominio.filter((p) => p.finalidade === 'aluguel')} />

        {vendaDireta ? (
          <section className="mt-10 flex flex-col items-start gap-3 rounded-2xl border border-accent/40 bg-[#f5f8ff] p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div>
              <h2 className="font-serif text-xl font-semibold">Quer comprar uma unidade no {development.name}?</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Fale conosco e verifique as disponibilidades particulares e direto pela incorporadora.</p>
            </div>
            <BotaoWhatsapp ctx={whatsAtendimento} variante="pilula" rotulo="Fale conosco" />
          </section>
        ) : (
          <InterestForm developmentId={development.id} condominio={development.name} destaque={related.mesmoCondominio.length === 0} />
        )}

        {/* logo abaixo do quadro de interesse: últimas notícias do mercado */}
        <VitrineNews bairro={development.bairro} cidade={development.cidade} />

        {!semUnidade && secoesParecidos}
      </main>

      <Footer />
      {development.status !== 'rascunho' && (
        <>
          <EspacoBarra />
          <BarraContatoFixa favoritoId={development.id} whats={whatsAtendimento} compartilhar={{ url: `${SITE_URL}${urlCondominio(development)}`, titulo: development.name, refId: development.id }} />
        </>
      )}
    </div>
  );
}

'use client';

// Mapa dos imóveis e condomínios (MapLibre + OpenFreeMap: gratuito, sem chave,
// sem limite de visitas). Desenhado pela placa de vídeo, aguenta milhares de pontos.
//  - Condomínio em breve lançamento, lançamento, obras ou pronto novo, ou com
//    anúncio: etiqueta colorida com nome e preço ("a partir de" ou dos anúncios).
//  - Seminovo, usado e antigo SEM anúncio: ponto cinza, "apagado".
//  - Anúncio avulso fora de condomínio: etiqueta com o preço (privado = escura).
//    Anúncio ligado a um condomínio entra dentro do ponto do condomínio.
//  - Mapa afastado: etiquetas viram uma bolinha com a quantidade e a faixa de preço.
//  - Localização aproximada (imóvel de rua): círculo, não ponto exato.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent, Marker, Popup } from 'maplibre-gl';
import { getBadgeCondominio, getStatusBucket, temEntrega, BUCKET_LABEL, type StatusBucket } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { precoCurto, type PontoCondominio, type PontoImovel, type PontoMapa } from '@/lib/mapa-tipos';
import { SITE_URL } from '@/lib/seo';

const ESTILO = 'https://tiles.openfreemap.org/styles/positron';
const CENTRO_GOIANIA: [number, number] = [-49.2648, -16.6869];
const FONTE = ['Noto Sans Bold'];
const FONTE_REG = ['Noto Sans Regular'];

// Cores das etiquetas (mesmas das fases no site)
const COR_FASE: Partial<Record<StatusBucket, string>> = {
  breve_lancamento: '#6A3CFF',
  lancamento: '#257CFF',
  obras: '#E08A00',
  novo: '#1B5FCC'
};
const COR_COM_ANUNCIO = '#13874B';
const FASES_ACESAS: StatusBucket[] = ['breve_lancamento', 'lancamento', 'obras', 'novo'];

export const LEGENDA: { cor: string; texto: string; borda?: string; ponto?: boolean }[] = [
  { cor: '#6A3CFF', texto: 'Breve lançamento' },
  { cor: '#257CFF', texto: 'Lançamento' },
  { cor: '#E08A00', texto: 'Obras' },
  { cor: '#1B5FCC', texto: 'Pronto novo' },
  { cor: COR_COM_ANUNCIO, texto: 'Condomínio com anúncio' },
  { cor: '#FFFFFF', borda: '#C9CDD3', texto: 'Anúncio avulso' },
  { cor: '#20242C', texto: 'Anúncio privado (equipe)' },
  { cor: '#A3A8AF', texto: 'Sem anúncio (seminovo, usado, antigo)', ponto: true }
];

type Condo = PontoCondominio & { imoveis: PontoImovel[] };

/** Junta os anúncios aos condomínios e calcula o que cada ponto mostra */
function prepararDados(pontos: PontoMapa[]) {
  const condos = new Map<string, Condo>();
  for (const p of pontos) if (p.tipo === 'condominio') condos.set(p.id, { ...p, imoveis: [] });
  const soltos: PontoImovel[] = [];
  for (const p of pontos) {
    if (p.tipo !== 'imovel') continue;
    const c = p.condominioId ? condos.get(p.condominioId) : undefined;
    if (c) c.imoveis.push(p);
    else soltos.push(p);
  }

  const ativos: GeoJSON.Feature[] = [];
  const apagados: GeoJSON.Feature[] = [];
  const aprox: GeoJSON.Feature[] = [];
  const pt = (lng: number, lat: number): GeoJSON.Point => ({ type: 'Point', coordinates: [lng, lat] });

  for (const c of Array.from(condos.values())) {
    const fase = temEntrega(c.entrega) ? getStatusBucket(c.entrega) : null;
    const comAnuncio = c.imoveis.length > 0;
    const acesa = (fase && FASES_ACESAS.includes(fase)) || comAnuncio;
    const nome = c.nome.length > 24 ? `${c.nome.slice(0, 23)}…` : c.nome;
    if (!acesa) {
      apagados.push({ type: 'Feature', geometry: pt(c.lng, c.lat), properties: { k: `c:${c.id}`, nome } });
      continue;
    }
    const precos = c.imoveis.map((i) => i.preco).filter((v): v is number => !!v && v > 0);
    const menor = precos.length ? Math.min(...precos) : c.preco;
    let linha2: string;
    if (comAnuncio) {
      const n = c.imoveis.length;
      linha2 = `${n} anúncio${n > 1 ? 's' : ''}${menor ? ` · ${precos.length > 1 ? 'desde ' : ''}${precoCurto(menor)}` : ''}`;
    } else linha2 = c.preco ? `a partir de ${precoCurto(c.preco)}` : fase ? BUCKET_LABEL[fase] : '';
    const cor = fase && FASES_ACESAS.includes(fase) ? COR_FASE[fase]! : COR_COM_ANUNCIO;
    ativos.push({
      type: 'Feature',
      geometry: pt(c.lng, c.lat),
      properties: {
        k: `c:${c.id}`,
        pill: `pill-${cor}`,
        cor,
        txt: '#FFFFFF',
        l1: nome,
        l2: linha2,
        prio: comAnuncio ? 0 : fase === 'lancamento' || fase === 'breve_lancamento' ? 1 : 2,
        pmin: menor ?? 1e13,
        pmax: menor ?? 0
      }
    });
  }
  for (const i of soltos) {
    const cor = i.privado ? '#20242C' : '#FFFFFF';
    ativos.push({
      type: 'Feature',
      geometry: pt(i.lng, i.lat),
      properties: {
        k: `i:${i.id}`,
        pill: i.privado ? 'pill-#20242C' : 'pill-branca',
        cor: i.privado ? '#20242C' : '#257CFF',
        txt: i.privado ? '#FFFFFF' : '#14161A',
        l1: '',
        l2: i.preco ? precoCurto(i.preco) : 'Consulte',
        prio: 0,
        pmin: i.preco ?? 1e13,
        pmax: i.preco ?? 0
      }
    });
    if (i.aproximada && !i.herdaPosicao) aprox.push({ type: 'Feature', geometry: pt(i.lng, i.lat), properties: { cor } });
  }
  return { condos, soltos, ativos, apagados, aprox };
}

/** Desenha a etiqueta arredondada (esticável) que fica atrás do texto */
function imagemPilula(fundo: string, borda: string) {
  const r = 2; // pixelRatio
  const w = 40;
  const h = 30;
  const raio = 10;
  const c = document.createElement('canvas');
  c.width = w * r;
  c.height = h * r;
  const ctx = c.getContext('2d')!;
  ctx.scale(r, r);
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, raio);
  ctx.fillStyle = fundo;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = borda;
  ctx.stroke();
  const img = ctx.getImageData(0, 0, w * r, h * r);
  return {
    img: { width: img.width, height: img.height, data: new Uint8Array(img.data.buffer) },
    opcoes: {
      pixelRatio: r,
      stretchX: [[raio * r, (w - raio) * r]] as [number, number][],
      stretchY: [[raio * r, (h - raio) * r]] as [number, number][],
      content: [6 * r, 5 * r, (w - 6) * r, (h - 5) * r] as [number, number, number, number]
    }
  };
}

// "R$ 450 mil", "R$ 1,2 mi" dentro das expressões do mapa (bolinha do agrupamento)
const fmtExpr = (x: unknown) => [
  'case',
  ['>=', x, 1000000],
  ['concat', ['number-format', ['/', x, 1000000], { locale: 'pt-BR', 'max-fraction-digits': 1 }], ' mi'],
  ['concat', ['number-format', ['/', x, 1000], { locale: 'pt-BR', 'max-fraction-digits': 0 }], ' mil']
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, estilo: string, texto?: string, filhos: (HTMLElement | null)[] = []) {
  const e = document.createElement(tag);
  if (estilo) e.setAttribute('style', estilo);
  if (texto) e.textContent = texto;
  filhos.forEach((f) => f && e.appendChild(f));
  return e;
}
const botaoCss = 'display:inline-block;margin:6px 6px 0 0;padding:6px 10px;border-radius:999px;font:600 12px/1.2 Inter,system-ui,sans-serif;text-decoration:none;cursor:pointer;border:1px solid #D5D8DD;background:#fff;color:#14161A';
function linkBotao(texto: string, href: string, primario = false) {
  const a = el('a', botaoCss + (primario ? ';background:#257CFF;border-color:#257CFF;color:#fff' : ''), texto) as HTMLAnchorElement;
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}
const streetView = (lat: number, lng: number) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
const detalhes = (i: { quartos: number | null; area: number | null; vagas: number | null }) =>
  [i.quartos ? `${i.quartos} qto${i.quartos > 1 ? 's' : ''}` : '', i.vagas ? `${i.vagas} vaga${i.vagas > 1 ? 's' : ''}` : '', i.area ? `${Math.round(i.area)} m²` : '']
    .filter(Boolean)
    .join(' · ');

export type Foco = { lat: number; lng: number; texto: string; ts: number };

export default function MapaImoveis({
  pontos,
  foco,
  onMover
}: {
  pontos: PontoMapa[];
  foco?: Foco | null;
  onMover?: (tipo: 'imovel' | 'condominio', id: string, lat: number, lng: number) => Promise<void>;
}) {
  const caixa = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<MLMap | null>(null);
  const lib = useRef<typeof import('maplibre-gl') | null>(null);
  const popup = useRef<Popup | null>(null);
  const marcadorFoco = useRef<Marker | null>(null);
  const marcadorMover = useRef<Marker | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erroMapa, setErroMapa] = useState<string | null>(null);
  const [movendo, setMovendo] = useState<{ tipo: 'imovel' | 'condominio'; id: string; nome: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const enquadrou = useRef('');
  const dados = useMemo(() => prepararDados(pontos), [pontos]);
  const dadosRef = useRef(dados);
  dadosRef.current = dados;

  // cria o mapa uma vez
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const mod = await import('maplibre-gl');
      // o pacote vem como CommonJS/UMD: as classes podem estar em .default
      const maplibregl = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      if (cancelado || !caixa.current) return;
      lib.current = maplibregl;
      const m = new maplibregl.Map({
        container: caixa.current,
        style: ESTILO,
        center: CENTRO_GOIANIA,
        zoom: 11.2,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false
      });
      m.touchZoomRotate.disableRotation();
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), 'top-right');
      m.on('error', (e) => {
        if (!m.isStyleLoaded()) setErroMapa(String((e as { error?: Error }).error?.message ?? 'Não foi possível carregar o mapa.'));
      });
      m.on('load', () => {
        // etiquetas: uma imagem por cor
        const cores = ['#6A3CFF', '#257CFF', '#E08A00', '#1B5FCC', COR_COM_ANUNCIO, '#20242C'];
        for (const c of cores) {
          const { img, opcoes } = imagemPilula(c, c);
          m.addImage(`pill-${c}`, img, opcoes);
        }
        const branca = imagemPilula('#FFFFFF', '#C9CDD3');
        m.addImage('pill-branca', branca.img, branca.opcoes);
        const grupo = imagemPilula('#14161A', '#14161A');
        m.addImage('pill-grupo', grupo.img, grupo.opcoes);

        const vazio: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
        m.addSource('aprox', { type: 'geojson', data: vazio });
        m.addSource('apagados', { type: 'geojson', data: vazio });
        m.addSource('ativos', {
          type: 'geojson',
          data: vazio,
          cluster: true,
          clusterRadius: 46,
          clusterMaxZoom: 13,
          clusterProperties: { pmin: ['min', ['get', 'pmin']], pmax: ['max', ['get', 'pmax']] }
        });

        // círculo de localização aproximada (~250 m)
        m.addLayer({
          id: 'aprox',
          type: 'circle',
          source: 'aprox',
          paint: {
            'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 10, 1.6, 14, 26, 18, 420],
            'circle-color': ['get', 'cor'],
            'circle-opacity': 0.12,
            'circle-stroke-color': ['get', 'cor'],
            'circle-stroke-width': 1,
            'circle-stroke-opacity': 0.5
          }
        });
        // apagados: ponto cinza; o nome aparece só bem de perto
        m.addLayer({
          id: 'apagados',
          type: 'circle',
          source: 'apagados',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 4.5],
            'circle-color': '#A3A8AF',
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 1
          }
        });
        m.addLayer({
          id: 'apagados-nome',
          type: 'symbol',
          source: 'apagados',
          minzoom: 15.5,
          layout: { 'text-field': ['get', 'nome'], 'text-font': FONTE_REG, 'text-size': 11, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true },
          paint: { 'text-color': '#7A7F87', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.2 }
        });
        // ponto colorido embaixo da etiqueta (se a etiqueta não couber, o ponto continua)
        m.addLayer({
          id: 'ativos-ponto',
          type: 'circle',
          source: 'ativos',
          filter: ['!', ['has', 'point_count']],
          paint: { 'circle-radius': 4.5, 'circle-color': ['get', 'cor'], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5 }
        });
        // agrupamento: quantidade + faixa de preço
        m.addLayer({
          id: 'grupos',
          type: 'symbol',
          source: 'ativos',
          filter: ['has', 'point_count'],
          layout: {
            'icon-image': 'pill-grupo',
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [2, 8, 2, 8],
            'icon-allow-overlap': true,
            'text-allow-overlap': true,
            'text-font': FONTE,
            'text-size': 12.5,
            'text-line-height': 1.25,
            'text-field': [
              'format',
              ['to-string', ['get', 'point_count']],
              { 'font-scale': 1.1 },
              ['case', ['>', ['get', 'pmax'], 0], ['concat', '\n', 'R$ ', fmtExpr(['get', 'pmin']), ' a ', fmtExpr(['get', 'pmax'])], ''],
              { 'font-scale': 0.82 }
            ]
          },
          paint: { 'text-color': '#FFFFFF' }
        } as never);
        // etiquetas com nome e preço
        m.addLayer({
          id: 'ativos',
          type: 'symbol',
          source: 'ativos',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': ['get', 'pill'],
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [2, 7, 2, 7],
            'text-font': FONTE,
            'text-size': 12,
            'text-line-height': 1.2,
            'text-anchor': 'bottom',
            'text-offset': [0, -0.7],
            'symbol-sort-key': ['get', 'prio'],
            'text-field': [
              'format',
              ['get', 'l1'],
              { 'font-scale': 0.88 },
              ['case', ['==', ['get', 'l1'], ''], '', '\n'],
              {},
              ['get', 'l2'],
              { 'font-scale': 1 }
            ]
          },
          paint: { 'text-color': ['get', 'txt'] }
        } as never);

        const clicar = (e: MapLayerMouseEvent) => abrirPopup(e);
        m.on('click', 'ativos', clicar);
        m.on('click', 'ativos-ponto', clicar);
        m.on('click', 'apagados', clicar);
        m.on('click', 'grupos', async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const src = m.getSource('ativos') as GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(f.properties?.cluster_id as number);
          m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.3 });
        });
        for (const id of ['ativos', 'ativos-ponto', 'apagados', 'grupos']) {
          m.on('mouseenter', id, () => (m.getCanvas().style.cursor = 'pointer'));
          m.on('mouseleave', id, () => (m.getCanvas().style.cursor = ''));
        }
        setPronto(true);
      });
      mapa.current = m;
    })();
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // coloca os dados no mapa e enquadra quando os filtros mudam
  useEffect(() => {
    const m = mapa.current;
    if (!m || !pronto) return;
    (m.getSource('ativos') as GeoJSONSource).setData({ type: 'FeatureCollection', features: dados.ativos });
    (m.getSource('apagados') as GeoJSONSource).setData({ type: 'FeatureCollection', features: dados.apagados });
    (m.getSource('aprox') as GeoJSONSource).setData({ type: 'FeatureCollection', features: dados.aprox });
    // enquadra só quando o CONJUNTO muda (não depois de corrigir a posição de um ponto)
    const assinatura = `${pontos.length}:${pontos.slice(0, 30).map((p) => p.id).join(',')}`;
    if (assinatura === enquadrou.current || !pontos.length) return;
    enquadrou.current = assinatura;
    const base = dados.ativos.length >= 3 ? dados.ativos : [...dados.ativos, ...dados.apagados];
    if (!base.length) return;
    const lngs = base.map((f) => (f.geometry as GeoJSON.Point).coordinates[0]);
    const lats = base.map((f) => (f.geometry as GeoJSON.Point).coordinates[1]);
    // ignora pontos muito distantes da maioria (cadastro errado) usando os percentis
    const corte = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      const q = (p: number) => s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
      return s.length > 20 ? [q(0.02), q(0.98)] : [s[0], s[s.length - 1]];
    };
    const [x1, x2] = corte(lngs);
    const [y1, y2] = corte(lats);
    m.fitBounds(
      [
        [x1, y1],
        [x2, y2]
      ],
      { padding: 60, maxZoom: 15, duration: 600 }
    );
  }, [dados, pronto, pontos]);

  // busca de endereço: voa até lá e marca o lugar (ou leva o marcador de correção)
  useEffect(() => {
    const m = mapa.current;
    const L = lib.current;
    if (!m || !L || !foco) return;
    m.flyTo({ center: [foco.lng, foco.lat], zoom: 17, duration: 900 });
    if (marcadorMover.current) {
      marcadorMover.current.setLngLat([foco.lng, foco.lat]);
      return;
    }
    marcadorFoco.current?.remove();
    marcadorFoco.current = new L.Marker({ color: '#FF385C' }).setLngLat([foco.lng, foco.lat]).setPopup(new L.Popup({ offset: 24 }).setText(foco.texto)).addTo(m);
  }, [foco]);

  function abrirPopup(e: MapLayerMouseEvent) {
    const m = mapa.current;
    const L = lib.current;
    const f = e.features?.[0];
    if (!m || !L || !f) return;
    const k = String(f.properties?.k ?? '');
    const [tipo, id] = [k.slice(0, 1), k.slice(2)];
    const d = dadosRef.current;
    const conteudo = tipo === 'c' ? cartaoCondo(d.condos.get(id)) : cartaoImovel(d.soltos.find((i) => i.id === id));
    if (!conteudo) return;
    popup.current?.remove();
    popup.current = new L.Popup({ offset: 14, maxWidth: '300px', closeButton: true })
      .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
      .setDOMContent(conteudo)
      .addTo(m);
  }

  function cabecalho(capa: string | null, titulo: string, sub: string, etiqueta?: { texto: string; cor: string }) {
    const img = capa ? (el('img', 'width:100%;height:120px;object-fit:cover;border-radius:10px;display:block;margin-bottom:8px') as HTMLImageElement) : null;
    if (img && capa) {
      img.src = capa;
      img.alt = '';
    }
    return el('div', '', '', [
      img,
      etiqueta ? el('span', `display:inline-block;margin-bottom:4px;padding:2px 7px;border-radius:6px;background:${etiqueta.cor};color:#fff;font:700 10px/1.4 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em`, etiqueta.texto) : null,
      el('div', 'font:700 14px/1.3 Inter,system-ui,sans-serif;color:#14161A', titulo),
      sub ? el('div', 'font:12px/1.4 Inter,system-ui,sans-serif;color:#5B6068;margin-top:2px', sub) : null
    ]);
  }

  function botaoMover(tipo: 'imovel' | 'condominio', id: string, nome: string, lat: number, lng: number) {
    const b = el('button', botaoCss, 'Corrigir posição') as HTMLButtonElement;
    b.type = 'button';
    b.onclick = () => iniciarMover(tipo, id, nome, lat, lng);
    return b;
  }

  function cartaoCondo(c: Condo | undefined) {
    if (!c) return null;
    const badge = getBadgeCondominio(c.entrega, c.horizontal ? 'horizontal' : 'vertical');
    const etiqueta = badge.label ? { texto: badge.text, cor: badge.bg.startsWith('rgba') ? '#5B6B7A' : badge.bg } : { texto: 'Entrega ----', cor: '#5B6B7A' };
    const local = [c.bairro, c.cidade].filter(Boolean).join(', ');
    const lista = el('div', 'margin-top:8px;display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto');
    for (const i of c.imoveis.slice(0, 12)) {
      const a = el('a', 'display:block;padding:7px 9px;border-radius:10px;background:#F3F4F6;text-decoration:none;color:#14161A') as HTMLAnchorElement;
      a.href = `${SITE_URL}${i.url}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.appendChild(el('div', 'font:700 13px/1.3 Inter,system-ui,sans-serif', `${i.preco ? precoCurto(i.preco) : 'Consulte'}${i.privado ? ' · privado' : ''}`));
      const tipoU = i.tipoUnidade ? TIPO_UNIDADE_LABEL[i.tipoUnidade as TipoUnidade] ?? '' : '';
      a.appendChild(el('div', 'font:12px/1.3 Inter,system-ui,sans-serif;color:#5B6068', [tipoU, detalhes(i)].filter(Boolean).join(' · ')));
      lista.appendChild(a);
    }
    if (c.imoveis.length > 12) lista.appendChild(el('div', 'font:12px Inter,system-ui,sans-serif;color:#5B6068', `+ ${c.imoveis.length - 12} anúncios`));
    const precoLinha = c.preco ? el('div', 'font:600 13px/1.4 Inter,system-ui,sans-serif;margin-top:4px', `Tipologias a partir de ${precoCurto(c.preco)}`) : null;
    const posicao =
      c.precisao && !['ROOFTOP', 'MANUAL', 'RANGE_INTERPOLATED'].includes(c.precisao)
        ? el('div', 'font:11.5px/1.4 Inter,system-ui,sans-serif;color:#B45309;margin-top:6px', 'Posição aproximada: confira e corrija se precisar.')
        : null;
    return el('div', 'min-width:230px', '', [
      cabecalho(c.capa, c.nome, local, etiqueta),
      precoLinha,
      c.imoveis.length ? lista : null,
      posicao,
      el('div', '', '', [
        linkBotao('Abrir página', `${SITE_URL}${c.url}`, true),
        linkBotao('Editar', `/dashboard/condominios/${c.id}/editar`),
        linkBotao('Street View', streetView(c.lat, c.lng)),
        c.podeMover && onMover ? botaoMover('condominio', c.id, c.nome, c.lat, c.lng) : null
      ])
    ]);
  }

  function cartaoImovel(i: PontoImovel | undefined) {
    if (!i) return null;
    const tipoU = i.tipoUnidade ? TIPO_UNIDADE_LABEL[i.tipoUnidade as TipoUnidade] ?? 'Imóvel' : 'Imóvel';
    const local = [i.bairro, i.cidade].filter(Boolean).join(', ');
    const etiqueta = i.privado ? { texto: 'Privado', cor: '#20242C' } : undefined;
    return el('div', 'min-width:220px', '', [
      cabecalho(i.capa, i.preco ? precoCurto(i.preco) : 'Consulte', [tipoU, local].filter(Boolean).join(' · '), etiqueta),
      el('div', 'font:12.5px/1.4 Inter,system-ui,sans-serif;color:#14161A;margin-top:2px', [i.nome !== tipoU ? i.nome : '', detalhes(i)].filter(Boolean).join(' · ')),
      i.aproximada ? el('div', 'font:11.5px/1.4 Inter,system-ui,sans-serif;color:#5B6068;margin-top:4px', 'Localização aproximada (o círculo mostra a região).') : null,
      el('div', '', '', [
        linkBotao('Abrir anúncio', `${SITE_URL}${i.url}`, true),
        linkBotao('Editar', `/dashboard/imoveis/${i.id}/editar`),
        linkBotao('Street View', streetView(i.lat, i.lng)),
        i.podeMover && onMover ? botaoMover('imovel', i.id, i.nome, i.lat, i.lng) : null
      ])
    ]);
  }

  function iniciarMover(tipo: 'imovel' | 'condominio', id: string, nome: string, lat: number, lng: number) {
    const m = mapa.current;
    const L = lib.current;
    if (!m || !L) return;
    popup.current?.remove();
    marcadorFoco.current?.remove();
    marcadorMover.current?.remove();
    marcadorMover.current = new L.Marker({ draggable: true, color: '#257CFF' }).setLngLat([lng, lat]).addTo(m);
    m.easeTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 16.5) });
    setMovendo({ tipo, id, nome });
  }

  function cancelarMover() {
    marcadorMover.current?.remove();
    marcadorMover.current = null;
    setMovendo(null);
  }

  async function salvarMover() {
    if (!movendo || !marcadorMover.current || !onMover) return;
    const { lat, lng } = marcadorMover.current.getLngLat();
    setSalvando(true);
    try {
      await onMover(movendo.tipo, movendo.id, lat, lng);
      cancelarMover();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não foi possível salvar a posição.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={caixa} className="h-full w-full" />
      {erroMapa && (
        <div className="absolute inset-x-4 top-4 rounded-xl bg-red-50 p-3 text-[13px] text-red-700 shadow">Mapa indisponível agora: {erroMapa}</div>
      )}
      {movendo && (
        <div className="absolute inset-x-3 bottom-4 z-10 mx-auto flex max-w-[560px] flex-wrap items-center gap-2 rounded-2xl bg-[var(--bg)] p-3 shadow-2xl md:inset-x-auto md:left-1/2 md:-translate-x-1/2">
          <p className="min-w-[200px] flex-1 text-[13px]">
            Arraste o marcador azul até o lugar certo de <b>{movendo.nome}</b>. A busca de endereço também move o marcador.
          </p>
          <button type="button" onClick={cancelarMover} className="h-10 rounded-full border border-[var(--border)] px-4 text-[13px] font-semibold">
            Cancelar
          </button>
          <button type="button" disabled={salvando} onClick={salvarMover} className="h-10 rounded-full bg-accent px-4 text-[13px] font-bold text-white disabled:opacity-60">
            {salvando ? 'Salvando…' : 'Salvar posição'}
          </button>
        </div>
      )}
    </div>
  );
}

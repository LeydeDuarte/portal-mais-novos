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
import { linkWhatsapp, precoCurto, type PontoCondominio, type PontoImovel, type PontoMapa } from '@/lib/mapa-tipos';
import { SITE_URL } from '@/lib/seo';
import * as SunCalc from 'suncalc';

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
const WHATS_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l1.7-4.6A8.5 8.5 0 1 1 8 19.6L3 21z"></path></svg>';
/** Mensagem para o proprietário (só no painel) */
function linkDono(i: PontoImovel): string | null {
  if (!i.dono?.whatsapp) return null;
  const primeiro = i.dono.nome.trim().split(/\s+/)[0] || '';
  const onde = [i.nome, i.bairro].filter(Boolean).join(', ');
  return linkWhatsapp(i.dono.whatsapp, `Olá${primeiro ? `, ${primeiro}` : ''}! Aqui é da Mais Novos Imóveis, sobre o seu imóvel ${onde}.`);
}
const streetView = (lat: number, lng: number) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
const detalhes = (i: { quartos: number | null; area: number | null; vagas: number | null }) =>
  [i.quartos ? `${i.quartos} qto${i.quartos > 1 ? 's' : ''}` : '', i.vagas ? `${i.vagas} vaga${i.vagas > 1 ? 's' : ''}` : '', i.area ? `${Math.round(i.area)} m²` : '']
    .filter(Boolean)
    .join(' · ');

// ---------- posição do sol (teste no painel) ----------
// Desenho tipo "cúpula do céu" vista de cima: a borda do círculo é o horizonte e o
// centro é o sol a pino. Quanto mais alto o sol, mais perto do centro fica o ponto.
const RAIO_SOL = 160; // metros
const FUSO_GOIANIA = 3; // UTC-3, sem horário de verão
type DiaSol = 'hoje' | 'inverno' | 'verao';
function destino(lat: number, lng: number, azimute: number, metros: number): [number, number] {
  const r = (azimute * Math.PI) / 180;
  return [lng + (metros * Math.sin(r)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (metros * Math.cos(r)) / 111320];
}
function dataDoDia(dia: DiaSol): { y: number; m: number; d: number } {
  const agora = new Date(Date.now() - FUSO_GOIANIA * 3600000);
  const y = agora.getUTCFullYear();
  if (dia === 'inverno') return { y, m: 5, d: 21 };
  if (dia === 'verao') return { y, m: 11, d: 21 };
  return { y, m: agora.getUTCMonth(), d: agora.getUTCDate() };
}
const instante = (dia: { y: number; m: number; d: number }, minutos: number) =>
  new Date(Date.UTC(dia.y, dia.m, dia.d, 0, 0) + (minutos + FUSO_GOIANIA * 60) * 60000);
const horaTexto = (dt: Date) => dt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
function rumo(az: number): string {
  const nomes = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
  return nomes[Math.round((((az % 360) + 360) % 360) / 45) % 8];
}
function trajetoria(lat: number, lng: number, dia: { y: number; m: number; d: number }): [number, number][] {
  const pts: [number, number][] = [];
  for (let min = 4 * 60; min <= 20 * 60; min += 10) {
    const p = SunCalc.getPosition(instante(dia, min), lat, lng);
    if (p.altitude < 0) continue;
    pts.push(destino(lat, lng, p.azimuth, RAIO_SOL * (1 - p.altitude / 90)));
  }
  return pts;
}
function geoSol(lat: number, lng: number, diaSel: DiaSol, minutos: number) {
  const f: GeoJSON.Feature[] = [];
  const anel: [number, number][] = [];
  for (let a = 0; a <= 360; a += 5) anel.push(destino(lat, lng, a, RAIO_SOL));
  f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: anel }, properties: { k: 'anel' } });
  for (const [t, az] of [['N', 0], ['L', 90], ['S', 180], ['O', 270]] as [string, number][])
    f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: destino(lat, lng, az, RAIO_SOL * 1.14) }, properties: { k: 'rotulo', t } });
  // referências do ano: inverno (sol mais ao norte) e verão (quase a pino)
  if (diaSel !== 'inverno') f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: trajetoria(lat, lng, dataDoDia('inverno')) }, properties: { k: 'inverno' } });
  if (diaSel !== 'verao') f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: trajetoria(lat, lng, dataDoDia('verao')) }, properties: { k: 'verao' } });
  const dia = dataDoDia(diaSel);
  f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: trajetoria(lat, lng, dia) }, properties: { k: 'dia' } });
  const tempos = SunCalc.getTimes(instante(dia, 12 * 60), lat, lng);
  // em Goiânia o sol sempre nasce e se põe; o reserva só satisfaz os tipos
  const nasce = tempos.sunrise ?? instante(dia, 6 * 60);
  const poe = tempos.sunset ?? instante(dia, 18 * 60);
  const azNascer = SunCalc.getPosition(nasce, lat, lng).azimuth;
  const azPor = SunCalc.getPosition(poe, lat, lng).azimuth;
  f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lng, lat], destino(lat, lng, azNascer, RAIO_SOL)] }, properties: { k: 'nascer' } });
  f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lng, lat], destino(lat, lng, azPor, RAIO_SOL)] }, properties: { k: 'por' } });
  const agora = SunCalc.getPosition(instante(dia, minutos), lat, lng);
  if (agora.altitude > 0) {
    const ponto = destino(lat, lng, agora.azimuth, RAIO_SOL * (1 - agora.altitude / 90));
    f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lng, lat], ponto] }, properties: { k: 'agora' } });
    f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: ponto }, properties: { k: 'sol' } });
  }
  const resumo = {
    nascer: `${horaTexto(nasce)} (${rumo(azNascer)})`,
    por: `${horaTexto(poe)} (${rumo(azPor)})`,
    agora:
      agora.altitude > 0
        ? `O sol está a ${Math.round(agora.altitude)}° de altura, vindo do ${rumo(agora.azimuth)} (${Math.round(agora.azimuth)}°).`
        : 'O sol está abaixo do horizonte nesse horário.'
  };
  return { geo: { type: 'FeatureCollection', features: f } as GeoJSON.FeatureCollection, resumo };
}

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
  const [sol, setSol] = useState<{ lat: number; lng: number; nome: string } | null>(null);
  const [diaSol, setDiaSol] = useState<DiaSol>('hoje');
  const [minSol, setMinSol] = useState(() => {
    const agora = new Date(Date.now() - FUSO_GOIANIA * 3600000);
    const m = agora.getUTCHours() * 60 + agora.getUTCMinutes();
    return m >= 6 * 60 && m <= 18 * 60 ? m - (m % 10) : 12 * 60;
  });
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
        // posição do sol (fica embaixo das etiquetas)
        m.addSource('sol', { type: 'geojson', data: vazio });
        m.addLayer({ id: 'sol-anel', type: 'line', source: 'sol', filter: ['==', ['get', 'k'], 'anel'], paint: { 'line-color': '#5B6068', 'line-width': 1.2, 'line-dasharray': [2, 2] } });
        m.addLayer({ id: 'sol-inverno', type: 'line', source: 'sol', filter: ['==', ['get', 'k'], 'inverno'], paint: { 'line-color': '#3B82F6', 'line-width': 2, 'line-opacity': 0.6 } });
        m.addLayer({ id: 'sol-verao', type: 'line', source: 'sol', filter: ['==', ['get', 'k'], 'verao'], paint: { 'line-color': '#DC2626', 'line-width': 2, 'line-opacity': 0.6 } });
        m.addLayer({ id: 'sol-dia', type: 'line', source: 'sol', filter: ['==', ['get', 'k'], 'dia'], paint: { 'line-color': '#F59E0B', 'line-width': 4 } });
        m.addLayer({ id: 'sol-nascer', type: 'line', source: 'sol', filter: ['==', ['get', 'k'], 'nascer'], paint: { 'line-color': '#F59E0B', 'line-width': 2, 'line-dasharray': [1, 1.5] } });
        m.addLayer({ id: 'sol-por', type: 'line', source: 'sol', filter: ['==', ['get', 'k'], 'por'], paint: { 'line-color': '#B45309', 'line-width': 2, 'line-dasharray': [1, 1.5] } });
        m.addLayer({ id: 'sol-agora', type: 'line', source: 'sol', filter: ['==', ['get', 'k'], 'agora'], paint: { 'line-color': '#F59E0B', 'line-width': 3 } });
        m.addLayer({ id: 'sol-ponto', type: 'circle', source: 'sol', filter: ['==', ['get', 'k'], 'sol'], paint: { 'circle-radius': 11, 'circle-color': '#FBBF24', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
        m.addLayer({
          id: 'sol-rotulos',
          type: 'symbol',
          source: 'sol',
          filter: ['==', ['get', 'k'], 'rotulo'],
          layout: { 'text-field': ['get', 't'], 'text-font': FONTE, 'text-size': 14, 'text-allow-overlap': true },
          paint: { 'text-color': '#14161A', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 }
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

  // desenha (ou apaga) a posição do sol
  const resumoSol = useMemo(() => (sol ? geoSol(sol.lat, sol.lng, diaSol, minSol) : null), [sol, diaSol, minSol]);
  useEffect(() => {
    const m = mapa.current;
    if (!m || !pronto) return;
    const src = m.getSource('sol') as GeoJSONSource | undefined;
    src?.setData(resumoSol ? resumoSol.geo : { type: 'FeatureCollection', features: [] });
  }, [resumoSol, pronto]);

  function iniciarSol(lat: number, lng: number, nome: string) {
    popup.current?.remove();
    setSol({ lat, lng, nome });
    mapa.current?.easeTo({ center: [lng, lat], zoom: 17, duration: 700 });
  }

  function botaoSol(lat: number, lng: number, nome: string) {
    const b = el('button', botaoCss, '☀ Sol') as HTMLButtonElement;
    b.type = 'button';
    b.title = 'Ver a posição do sol neste ponto';
    b.onclick = () => iniciarSol(lat, lng, nome);
    return b;
  }

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
      const linha = el('div', 'display:flex;align-items:stretch;gap:6px');
      const a = el('a', 'flex:1;min-width:0;display:block;padding:7px 9px;border-radius:10px;background:#F3F4F6;text-decoration:none;color:#14161A') as HTMLAnchorElement;
      a.href = `${SITE_URL}${i.url}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.appendChild(el('div', 'font:700 13px/1.3 Inter,system-ui,sans-serif', `${i.preco ? precoCurto(i.preco) : 'Consulte'}${i.privado ? ' · privado' : ''}`));
      const tipoU = i.tipoUnidade ? TIPO_UNIDADE_LABEL[i.tipoUnidade as TipoUnidade] ?? '' : '';
      a.appendChild(el('div', 'font:12px/1.3 Inter,system-ui,sans-serif;color:#5B6068', [tipoU, detalhes(i)].filter(Boolean).join(' · ')));
      linha.appendChild(a);
      const wa = linkDono(i);
      if (wa) {
        const b = el('a', 'width:40px;flex-shrink:0;display:grid;place-items:center;border-radius:10px;background:#25D366;color:#08361A;text-decoration:none') as HTMLAnchorElement;
        b.href = wa;
        b.target = '_blank';
        b.rel = 'noopener';
        b.title = `WhatsApp do proprietário: ${i.dono?.nome ?? ''}`;
        b.setAttribute('aria-label', `WhatsApp do proprietário ${i.dono?.nome ?? ''}`);
        b.innerHTML = WHATS_SVG;
        linha.appendChild(b);
      }
      lista.appendChild(linha);
    }
    if (c.imoveis.length > 12) lista.appendChild(el('div', 'font:12px Inter,system-ui,sans-serif;color:#5B6068', `+ ${c.imoveis.length - 12} anúncios`));
    const precoLinha = c.preco ? el('div', 'font:600 13px/1.4 Inter,system-ui,sans-serif;margin-top:4px', `Tipologias a partir de ${precoCurto(c.preco)}`) : null;
    const posicao =
      c.precisao && !['ROOFTOP', 'MANUAL', 'RANGE_INTERPOLATED'].includes(c.precisao)
        ? el('div', 'font:11.5px/1.4 Inter,system-ui,sans-serif;color:#B45309;margin-top:6px', 'Posição aproximada: confira e corrija se precisar.')
        : null;
    // construtora / incorporadora (link para a página da empresa no site)
    let empresas: HTMLElement | null = null;
    if (c.empresas.length) {
      empresas = el('div', 'font:12.5px/1.4 Inter,system-ui,sans-serif;color:#14161A;margin-top:4px');
      empresas.appendChild(el('span', 'color:#5B6068', c.empresas.length > 1 ? 'Construtoras: ' : 'Construtora: '));
      c.empresas.forEach((e, k) => {
        if (k) empresas!.appendChild(document.createTextNode(' · '));
        if (e.slug) {
          const a = el('a', 'font-weight:700;color:#1A5FD0;text-decoration:none', e.nome) as HTMLAnchorElement;
          a.href = `${SITE_URL}/empresa/${e.slug}`;
          a.target = '_blank';
          a.rel = 'noopener';
          empresas!.appendChild(a);
        } else empresas!.appendChild(el('b', '', e.nome));
      });
    }
    return el('div', 'min-width:230px', '', [
      cabecalho(c.capa, c.nome, local, etiqueta),
      empresas,
      precoLinha,
      c.imoveis.length ? lista : null,
      posicao,
      el('div', '', '', [
        linkBotao('Abrir página', `${SITE_URL}${c.url}`, true),
        linkBotao('Editar', `/dashboard/condominios/${c.id}/editar`),
        linkBotao('Street View', streetView(c.lat, c.lng)),
        botaoSol(c.lat, c.lng, c.nome),
        c.podeMover && onMover ? botaoMover('condominio', c.id, c.nome, c.lat, c.lng) : null
      ])
    ]);
  }

  // proprietário (só aparece para quem pode mexer no anúncio)
  function blocoDono(i: PontoImovel) {
    if (!i.podeMover) return null;
    const wa = linkDono(i);
    if (wa && i.dono) {
      const a = el('a', 'margin-top:8px;height:40px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:999px;background:#25D366;color:#08361A;font:700 12.5px/1 Inter,system-ui,sans-serif;text-decoration:none') as HTMLAnchorElement;
      a.href = wa;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = WHATS_SVG;
      a.appendChild(document.createTextNode(` Proprietário: ${i.dono.nome.split(/\s+/).slice(0, 2).join(' ')}`));
      return a;
    }
    const aviso = el('div', 'margin-top:8px;font:12px/1.4 Inter,system-ui,sans-serif;color:#5B6068');
    aviso.appendChild(document.createTextNode(i.dono ? `Proprietário: ${i.dono.nome} (sem telefone). ` : 'Sem proprietário cadastrado. '));
    const l = el('a', 'font-weight:700;color:#1A5FD0', i.dono ? 'Completar' : 'Vincular') as HTMLAnchorElement;
    l.href = `/dashboard/imoveis/${i.id}/editar`;
    l.target = '_blank';
    aviso.appendChild(l);
    return aviso;
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
      blocoDono(i),
      el('div', '', '', [
        linkBotao('Abrir anúncio', `${SITE_URL}${i.url}`, true),
        linkBotao('Editar', `/dashboard/imoveis/${i.id}/editar`),
        linkBotao('Street View', streetView(i.lat, i.lng)),
        botaoSol(i.lat, i.lng, i.nome),
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
      {sol && resumoSol && !movendo && (
        <div className="absolute inset-x-3 bottom-4 z-10 mx-auto max-w-[520px] rounded-2xl bg-[var(--bg)] p-3.5 text-[13px] shadow-2xl md:inset-x-auto md:left-1/2 md:w-[520px] md:-translate-x-1/2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[14px] font-bold">Sol em {sol.nome}</div>
              <div className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">
                Nascer {resumoSol.resumo.nascer} · Pôr {resumoSol.resumo.por}
              </div>
            </div>
            <button type="button" onClick={() => setSol(null)} className="h-9 shrink-0 rounded-full border border-[var(--border)] px-3.5 text-[12.5px] font-semibold">
              Fechar
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(
              [
                ['hoje', 'Hoje'],
                ['inverno', '21 de junho (inverno)'],
                ['verao', '21 de dezembro (verão)']
              ] as [DiaSol, string][]
            ).map(([v, t]) => (
              <button
                key={v}
                type="button"
                onClick={() => setDiaSol(v)}
                className={`h-8 rounded-full px-3 text-[12.5px] font-semibold ${diaSol === v ? 'bg-accent text-white' : 'border border-[var(--border)]'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-3">
            <span className="w-12 text-[14px] font-bold tabular-nums">
              {String(Math.floor(minSol / 60)).padStart(2, '0')}:{String(minSol % 60).padStart(2, '0')}
            </span>
            <input
              type="range"
              min={5 * 60}
              max={19 * 60 + 30}
              step={10}
              value={minSol}
              onChange={(e) => setMinSol(Number(e.target.value))}
              className="flex-1 accent-[#F59E0B]"
              aria-label="Horário"
            />
          </label>
          <p className="mt-1.5 text-[12.5px]">{resumoSol.resumo.agora}</p>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-muted)]">
            <span><b style={{ color: '#F59E0B' }}>━</b> caminho do dia</span>
            <span><b style={{ color: '#3B82F6' }}>━</b> inverno</span>
            <span><b style={{ color: '#DC2626' }}>━</b> verão</span>
            <span>Borda do círculo = horizonte · centro = sol a pino</span>
          </p>
        </div>
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

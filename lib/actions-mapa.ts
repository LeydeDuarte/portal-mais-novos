'use server';

// Ferramentas do Google SÓ para a equipe (o mapa em si é MapLibre + OpenFreeMap,
// gratuito). A chave fica apenas no servidor (GOOGLE_MAPS_SERVER_KEY, Vercel):
//  - Geocoding API: descobre a posição do condomínio pelo endereço (uma vez; fica
//    gravada em developments.lat/lng, então o Google não é chamado de novo);
//  - Places API (New): busca de endereço/prédio no mapa do painel.
// Sem a chave, o mapa continua funcionando; só essas ferramentas somem.
// Limites diários configurados no Google Cloud (cotas) evitam qualquer cobrança.
import { query } from './db';
import { exigirEquipe, exigirGestor } from './staff-auth';

const CHAVE = () => process.env.GOOGLE_MAPS_SERVER_KEY || '';
// centro de Goiânia: puxa a busca para a região
const CENTRO = { latitude: -16.6869, longitude: -49.2648 };

export async function googleDisponivel(): Promise<boolean> {
  await exigirEquipe();
  return !!CHAVE();
}

const semAcento = (s: string | null | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export type StatusLocalizacao = { pendentes: number; falharam: number; localizados: number };

export async function statusLocalizacao(): Promise<StatusLocalizacao> {
  await exigirGestor();
  const r = await query<{ pendentes: string; falharam: string; localizados: string }>(
    `select count(*) filter (where lat is null and geo_tentado_em is null) as pendentes,
            count(*) filter (where lat is null and geo_tentado_em is not null) as falharam,
            count(*) filter (where lat is not null) as localizados
       from developments
      where status in ('publicado', 'rascunho')`
  );
  return { pendentes: Number(r[0]?.pendentes) || 0, falharam: Number(r[0]?.falharam) || 0, localizados: Number(r[0]?.localizados) || 0 };
}

/** Falhas voltam para a fila (ex.: depois de corrigir endereços) */
export async function tentarFalhasDeNovo(): Promise<void> {
  await exigirGestor();
  await query(`update developments set geo_tentado_em = null, geo_erro = null where lat is null and geo_tentado_em is not null`);
}

type Componente = { long_name: string; short_name: string; types: string[] };
type ResultadoGeo = {
  geometry: { location: { lat: number; lng: number }; location_type: string };
  types: string[];
  address_components: Componente[];
  partial_match?: boolean;
};

class ErroCota extends Error {}

async function geocodificar(endereco: string): Promise<ResultadoGeo[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', endereco);
  url.searchParams.set('components', 'country:BR');
  url.searchParams.set('region', 'br');
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('key', CHAVE());
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
  const j = (await r.json().catch(() => ({}))) as { status?: string; results?: ResultadoGeo[]; error_message?: string };
  if (j.status === 'OK') return j.results ?? [];
  if (j.status === 'ZERO_RESULTS') return [];
  // cota do dia acabou, chave recusada etc.: para tudo e avisa
  throw new ErroCota(`${j.status ?? r.status}${j.error_message ? `: ${j.error_message}` : ''}`);
}

/** O resultado precisa estar na MESMA cidade e ser mais preciso que "a cidade inteira" */
function escolher(resultados: ResultadoGeo[], cidade: string): { r: ResultadoGeo; nivel: 'endereco' | 'bairro' } | null {
  const c = semAcento(cidade);
  for (const r of resultados) {
    const cidades = r.address_components
      .filter((a) => a.types.includes('administrative_area_level_2') || a.types.includes('locality'))
      .map((a) => semAcento(a.long_name));
    if (c && !cidades.includes(c)) continue;
    const t = r.types;
    if (t.includes('locality') || t.includes('administrative_area_level_2') || t.includes('administrative_area_level_1') || t.includes('postal_code_prefix')) continue;
    const bairroSo = t.includes('sublocality') || t.includes('sublocality_level_1') || t.includes('neighborhood') || t.includes('political');
    const temRua = r.address_components.some((a) => a.types.includes('route')) || t.includes('premise') || t.includes('street_address') || t.includes('establishment');
    return { r, nivel: temRua && !bairroSo ? 'endereco' : 'bairro' };
  }
  return null;
}

type Pendente = { id: string; name: string; logradouro: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null };

async function localizarUm(c: Pendente): Promise<'ok' | 'aprox' | 'falhou'> {
  const cidade = c.cidade || 'Goiânia';
  const uf = c.uf || 'GO';
  const cep = (c.cep ?? '').replace(/\D/g, '');
  const cepFmt = cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : '';
  const partes = (xs: (string | null | undefined)[]) => xs.filter((x) => x && String(x).trim()).join(', ');
  const tentativas: { q: string; porNome: boolean }[] = [];
  if (c.logradouro) tentativas.push({ q: partes([c.logradouro, c.bairro, `${cidade} - ${uf}`, cepFmt]), porNome: false });
  // pelo nome do condomínio (o Google conhece muitos prédios e residenciais)
  tentativas.push({ q: partes([c.name, c.bairro, `${cidade} - ${uf}`]), porNome: true });
  if (!c.logradouro && cepFmt) tentativas.push({ q: partes([cepFmt, c.bairro, `${cidade} - ${uf}`]), porNome: false });

  let melhor: { r: ResultadoGeo; nivel: 'endereco' | 'bairro'; porNome: boolean } | null = null;
  for (const t of tentativas) {
    const achou = escolher(await geocodificar(t.q), cidade);
    if (achou && (!melhor || (melhor.nivel === 'bairro' && achou.nivel === 'endereco'))) melhor = { ...achou, porNome: t.porNome };
    if (melhor?.nivel === 'endereco') break;
  }
  if (!melhor) {
    await query(`update developments set geo_tentado_em = now(), geo_erro = 'nao_encontrado' where id = $1`, [c.id]);
    return 'falhou';
  }
  const { lat, lng } = melhor.r.geometry.location;
  // achado só pelo nome: pode ser outro prédio de nome parecido, então fica marcado para conferir
  const precisao = melhor.nivel === 'bairro' ? 'BAIRRO' : melhor.porNome ? 'NOME' : melhor.r.geometry.location_type;
  await query(
    `update developments set lat = $2, lng = $3, geo_fonte = 'google', geo_precisao = $4, geo_tentado_em = now(), geo_erro = null
      where id = $1 and lat is null`,
    [c.id, lat, lng, precisao]
  );
  return melhor.nivel === 'bairro' ? 'aprox' : 'ok';
}

export type LoteLocalizacao = { feitos: number; ok: number; aproximados: number; falharam: number; restantes: number; erro?: string };

/**
 * Localiza um lote de condomínios sem posição (chamado várias vezes pelo painel,
 * cada chamada cabe no tempo de uma função da Vercel). Prioridade: publicados com
 * anúncio, depois lançamentos/novos, depois o resto.
 */
export async function localizarCondominios(): Promise<LoteLocalizacao> {
  await exigirGestor();
  if (!CHAVE()) return { feitos: 0, ok: 0, aproximados: 0, falharam: 0, restantes: 0, erro: 'A chave do Google (GOOGLE_MAPS_SERVER_KEY) não está configurada na Vercel.' };
  const fim = Date.now() + 8000;
  const lote = await query<Pendente>(
    `select d.id, d.name, d.logradouro, d.bairro, d.cidade, d.uf, d.cep
       from developments d
      where d.lat is null and d.geo_tentado_em is null and d.status in ('publicado', 'rascunho')
        and (coalesce(d.logradouro, '') <> '' or coalesce(d.bairro, '') <> '' or coalesce(d.cep, '') <> '')
      order by (d.status = 'publicado') desc,
               exists (select 1 from properties x where x.empreendimento_id = d.id and not x.is_tipologia and x.vendido_em is null) desc,
               d.delivery_date desc nulls last
      limit 40`
  );
  const res: LoteLocalizacao = { feitos: 0, ok: 0, aproximados: 0, falharam: 0, restantes: 0 };
  // 4 de cada vez (rápido, sem estourar o limite por minuto)
  for (let i = 0; i < lote.length && Date.now() < fim && !res.erro; i += 4) {
    const grupo = lote.slice(i, i + 4);
    const saidas = await Promise.allSettled(grupo.map(localizarUm));
    for (const s of saidas) {
      if (s.status === 'fulfilled') {
        res.feitos++;
        if (s.value === 'ok') res.ok++;
        else if (s.value === 'aprox') res.aproximados++;
        else res.falharam++;
      } else if (s.reason instanceof ErroCota) {
        res.erro = `O Google recusou: ${s.reason.message}. Se for limite do dia, continue amanhã.`;
      } else {
        res.erro = 'Falha de conexão com o Google. Tente de novo em instantes.';
      }
    }
  }
  const r = await query<{ n: string }>(
    `select count(*) as n from developments
      where lat is null and geo_tentado_em is null and status in ('publicado', 'rascunho')
        and (coalesce(logradouro, '') <> '' or coalesce(bairro, '') <> '' or coalesce(cep, '') <> '')`
  );
  res.restantes = Number(r[0]?.n) || 0;
  return res;
}

// ---------------- Busca de endereço (Places API New) ----------------
export type SugestaoLugar = { placeId: string; principal: string; secundario: string };

export async function buscarLugares(texto: string, sessao: string): Promise<SugestaoLugar[]> {
  await exigirEquipe();
  const input = String(texto ?? '').trim().slice(0, 120);
  if (!CHAVE() || input.length < 3) return [];
  const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': CHAVE() },
    body: JSON.stringify({
      input,
      languageCode: 'pt-BR',
      regionCode: 'br',
      includedRegionCodes: ['br'],
      locationBias: { circle: { center: CENTRO, radius: 50000 } },
      sessionToken: String(sessao ?? '').slice(0, 64) || undefined
    }),
    signal: AbortSignal.timeout(6000),
    cache: 'no-store'
  }).catch(() => null);
  if (!r?.ok) return [];
  const j = (await r.json().catch(() => ({}))) as {
    suggestions?: { placePrediction?: { placeId: string; text?: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }[];
  };
  return (j.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
    .slice(0, 6)
    .map((p) => ({
      placeId: p.placeId,
      principal: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secundario: p.structuredFormat?.secondaryText?.text ?? ''
    }));
}

export async function posicaoDoLugar(placeId: string, sessao: string): Promise<{ lat: number; lng: number; endereco: string } | null> {
  await exigirEquipe();
  const id = String(placeId ?? '').replace(/[^\w-]/g, '').slice(0, 300);
  if (!CHAVE() || !id) return null;
  const url = new URL(`https://places.googleapis.com/v1/places/${id}`);
  if (sessao) url.searchParams.set('sessionToken', String(sessao).slice(0, 64));
  url.searchParams.set('languageCode', 'pt-BR');
  const r = await fetch(url, {
    headers: { 'X-Goog-Api-Key': CHAVE(), 'X-Goog-FieldMask': 'location,formattedAddress' },
    signal: AbortSignal.timeout(6000),
    cache: 'no-store'
  }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => ({}))) as { location?: { latitude: number; longitude: number }; formattedAddress?: string };
  if (!j.location) return null;
  return { lat: j.location.latitude, lng: j.location.longitude, endereco: j.formattedAddress ?? '' };
}

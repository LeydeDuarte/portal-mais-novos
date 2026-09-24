'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { query } from './db';
import { mapPropertyRow, mapDevelopmentRow, heightFromId, toStringArray, type PropertyRow, type DevelopmentRow } from './db-mappers';
import { signSession, verifySession, type StaffSessionPayload } from './session';
import type { PropertyDetail, Development } from './property-details';
import type { FilterState } from './filters';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from './tipologias';

const PAGE_SIZE = 12;
const STAFF_COOKIE = 'mn_staff';

// ---------------- Feed (Comprar + Lançamentos) — leitura paginada e filtrada ----------------
// O feed mistura dois tipos de card: imóveis (tabela `properties`) e
// empreendimentos/condomínios (tabela `developments`). O modo "lancamentos"
// mostra só empreendimentos e imóveis avulsos com entrega no futuro.
// Paginação por offset por enquanto — trocar por cursor (created_at + id)
// antes do catálogo chegar a dezenas de milhares de linhas.
export type DevelopmentCardData = {
  id: string;
  name: string;
  location: string;
  deliveryDate: string; // "AAAA-MM"
  photos: string[];
  videoUrl?: string;
  tiposUnidade: TipoUnidade[];
  minPrice: number | null;
  quartosMin: number | null;
  quartosMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  unitsCount: number;
  aceitaTemporada: boolean;
  height: number;
};

export type FeedItem = { kind: 'imovel'; property: PropertyDetail } | { kind: 'empreendimento'; development: DevelopmentCardData };

// Busca sem acento e sem diferenciar maiúsculas ("goiania" acha "Goiânia")
const ACCENTS_FROM = 'áàâãäéèêëíìîïóòôõöúùûüç';
const ACCENTS_TO = 'aaaaaeeeeiiiiooooouuuuc';
const norm = (sqlExpr: string) => `translate(lower(${sqlExpr}), '${ACCENTS_FROM}', '${ACCENTS_TO}')`;
function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Palavras que não ajudam a busca ("apartamento no setor bueno" → "apartamento", "setor", "bueno")
const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'e', 'a', 'o', 'com', 'para', 'pra', 'um', 'uma']);

function searchTokens(q: string): string[] {
  return normalizeText(q)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .slice(0, 8);
}

// Rótulos dos tipos em texto, pra busca por "casa", "cobertura", "sobrado"...
// (tabela auxiliar `tl` montada uma vez no início da consulta)
const TIPOS_CTE = `tl(k, label) as (values ${Object.entries(TIPO_UNIDADE_LABEL)
  .map(([k, v]) => `('${k}', '${v.replace(/'/g, "''")}')`)
  .join(', ')})`;

export async function getFeedPage(page: number, filters: FilterState): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const params: unknown[] = [];
  const p = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  const propConds: string[] = [];
  const devConds: string[] = [];

  // ---- Condições dos imóveis (alias p, com o empreendimento em d) ----
  if (filters.finalidade !== 'todas') propConds.push(`p.finalidade = ${p(filters.finalidade)}`);
  if (filters.tipoUnidade !== 'todas') propConds.push(`p.tipo_unidade = ${p(filters.tipoUnidade)}`);
  if (filters.precoMax !== 'todas') propConds.push(`p.price_value <= ${p(filters.precoMax)}`);
  if (filters.quartosMin !== 'todas') propConds.push(`p.quartos >= ${p(filters.quartosMin)}`);
  if (filters.vagasMin !== 'todas') propConds.push(`p.vagas >= ${p(filters.vagasMin)}`);
  if (filters.aceitaTemporada === 'sim') propConds.push('p.aceita_temporada = true');
  if (filters.modo === 'lancamentos') propConds.push('p.empreendimento_id is null and p.delivery_date > now()');

  // ---- Condições dos empreendimentos (alias d, resumo das unidades em u) ----
  if (filters.finalidade === 'aluguel') devConds.push('false');
  if (filters.tipoUnidade !== 'todas') {
    const t = p(filters.tipoUnidade);
    devConds.push(`(d.tipos_unidade ? ${t} or coalesce(u.tipos, '[]'::jsonb) ? ${t})`);
  }
  if (filters.precoMax !== 'todas') devConds.push(`u.min_price <= ${p(filters.precoMax)}`);
  if (filters.quartosMin !== 'todas') devConds.push(`greatest(u.max_quartos, dq.max_quartos) >= ${p(filters.quartosMin)}`);
  if (filters.vagasMin !== 'todas') devConds.push(`u.max_vagas >= ${p(filters.vagasMin)}`);
  if (filters.aceitaTemporada === 'sim') devConds.push('d.aceita_temporada = true');

  // ---- Condições que valem para os dois ----
  const situacaoSql = (col: string) => {
    if (filters.situacao === 'lancamento') return `${col} > now()`;
    if (filters.situacao === 'seminovo') return `${col} <= now() and ${col} > now() - interval '5 years'`;
    if (filters.situacao === 'usado') return `${col} <= now() - interval '5 years'`;
    return null;
  };
  const sitP = situacaoSql('p.delivery_date');
  const sitD = situacaoSql('d.delivery_date');
  if (sitP) propConds.push(sitP);
  if (sitD) devConds.push(sitD);

  const anoMin = filters.anoMin && filters.anoMin > 1900 ? filters.anoMin : null;
  const anoMax = filters.anoMax && filters.anoMax > 1900 ? filters.anoMax : null;
  if (anoMin) {
    const v = p(anoMin);
    propConds.push(`extract(year from p.delivery_date) >= ${v}`);
    devConds.push(`extract(year from d.delivery_date) >= ${v}`);
  }
  if (anoMax) {
    const v = p(anoMax);
    propConds.push(`extract(year from p.delivery_date) <= ${v}`);
    devConds.push(`extract(year from d.delivery_date) <= ${v}`);
  }

  // Busca livre: cada palavra precisa aparecer em algum dos campos
  for (const token of searchTokens(filters.q || '')) {
    const v = p(`%${token}%`);
    propConds.push(`pt.txt like ${v}`);
    devConds.push(`dx.txt like ${v}`);
  }

  const where = (conds: string[]) => (conds.length ? `where ${conds.join(' and ')}` : '');
  params.push(PAGE_SIZE + 1, page * PAGE_SIZE);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const rows = await query<{ kind: 'imovel' | 'empreendimento'; id: string }>(
    `with ${TIPOS_CTE}
     select kind, id from (
       select 'imovel' as kind, p.id, p.created_at
         from properties p
         left join developments pd on pd.id = p.empreendimento_id
         left join tl ptl on ptl.k = p.tipo_unidade
         cross join lateral (
           select ${norm(`concat_ws(' ', p.titulo, p.location, p.bairro, p.cidade, p.condominio, pd.name, ptl.label)`)} as txt
         ) pt
         ${where(propConds)}
       union all
       select 'empreendimento' as kind, d.id, d.created_at
         from developments d
         left join lateral (
           select min(x.price_value) filter (where x.price_value > 0) as min_price,
                  max(x.quartos) as max_quartos,
                  max(x.vagas) as max_vagas,
                  jsonb_agg(distinct x.tipo_unidade) as tipos,
                  string_agg(distinct xtl.label, ' ') as tipos_texto
             from properties x left join tl xtl on xtl.k = x.tipo_unidade
            where x.empreendimento_id = d.id
         ) u on true
         left join lateral (
           select max(v::int) as max_quartos from jsonb_array_elements_text(d.quartos_opcoes) v
         ) dq on true
         left join lateral (
           select string_agg(ttl.label, ' ') as tipos_texto
             from jsonb_array_elements_text(d.tipos_unidade) t left join tl ttl on ttl.k = t
         ) dt on true
         cross join lateral (
           select ${norm(`concat_ws(' ', d.name, d.location, d.bairro, d.cidade, 'empreendimento condominio lancamento', u.tipos_texto, dt.tipos_texto)`)} as txt
         ) dx
         ${where(devConds)}
     ) feed
     order by created_at desc, id desc
     limit $${limitIdx} offset $${offsetIdx}`,
    params
  );

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);
  const propIds = pageRows.filter((r) => r.kind === 'imovel').map((r) => r.id);
  const devIds = pageRows.filter((r) => r.kind === 'empreendimento').map((r) => r.id);

  const [propRows, devCards] = await Promise.all([
    propIds.length ? query<PropertyRow>('select * from properties where id = any($1::text[])', [propIds]) : Promise.resolve([]),
    devIds.length ? getDevelopmentCards(devIds) : Promise.resolve([])
  ]);
  const propMap = new Map(propRows.map((r) => [r.id, mapPropertyRow(r)]));
  const devMap = new Map(devCards.map((d) => [d.id, d]));

  const items: FeedItem[] = [];
  for (const r of pageRows) {
    if (r.kind === 'imovel') {
      const property = propMap.get(r.id);
      if (property) items.push({ kind: 'imovel', property });
    } else {
      const development = devMap.get(r.id);
      if (development) items.push({ kind: 'empreendimento', development });
    }
  }
  return { items, hasMore };
}

async function getDevelopmentCards(ids: string[]): Promise<DevelopmentCardData[]> {
  const rows = await query<
    DevelopmentRow & {
      min_price: string | null;
      q_min: number | null;
      q_max: number | null;
      a_min: string | null;
      a_max: string | null;
      n: string;
      unit_tipos: unknown;
    }
  >(
    `select d.*, u.min_price, u.q_min, u.q_max, u.a_min, u.a_max, u.n, u.unit_tipos
       from developments d
       left join lateral (
         select min(x.price_value) filter (where x.price_value > 0) as min_price,
                min(x.quartos) as q_min, max(x.quartos) as q_max,
                min(x.area) as a_min, max(x.area) as a_max,
                count(*) as n, jsonb_agg(distinct x.tipo_unidade) as unit_tipos
           from properties x where x.empreendimento_id = d.id
       ) u on true
      where d.id = any($1::text[])`,
    [ids]
  );
  return rows.map((row) => {
    const base = mapDevelopmentRow(row, []);
    const tipos = Array.from(new Set([...(base.tiposUnidade ?? []), ...(toStringArray(row.unit_tipos) as TipoUnidade[])]));
    const quartos = [...(base.quartosOpcoes ?? []), ...[row.q_min, row.q_max].filter((n): n is number => n != null)];
    return {
      id: base.id,
      name: base.name,
      location: base.location,
      deliveryDate: base.deliveryDate,
      photos: base.photos ?? [],
      videoUrl: base.videoUrl,
      tiposUnidade: tipos,
      minPrice: row.min_price != null ? Number(row.min_price) : null,
      quartosMin: quartos.length ? Math.min(...quartos) : null,
      quartosMax: quartos.length ? Math.max(...quartos) : null,
      areaMin: row.a_min != null ? Number(row.a_min) : null,
      areaMax: row.a_max != null ? Number(row.a_max) : null,
      unitsCount: Number(row.n) || 0,
      aceitaTemporada: base.aceitaTemporada,
      height: heightFromId(base.id) + 40
    };
  });
}

// ---------------- Reconhecimento de condomínio pelo CEP ----------------
export type CondominioSugestao = { kind: 'empreendimento' | 'condominio'; id?: string; nome: string };

export async function findCondominiosByCep(cep: string): Promise<CondominioSugestao[]> {
  const digits = String(cep).replace(/\D/g, '');
  if (digits.length !== 8) return [];
  const [devs, condos] = await Promise.all([
    query<{ id: string; name: string }>('select id, name from developments where cep = $1 order by name limit 10', [digits]),
    query<{ condominio: string }>(
      `select distinct condominio from properties
        where cep = $1 and condominio is not null and condominio <> '' and empreendimento_id is null
        order by condominio limit 10`,
      [digits]
    )
  ]);
  const devNames = new Set(devs.map((d) => normalizeText(d.name)));
  return [
    ...devs.map((d) => ({ kind: 'empreendimento' as const, id: d.id, nome: d.name })),
    ...condos.filter((c) => !devNames.has(normalizeText(c.condominio))).map((c) => ({ kind: 'condominio' as const, nome: c.condominio }))
  ];
}

export async function getPropertyById(id: string): Promise<PropertyDetail | null> {
  const rows = await query<PropertyRow>('select * from properties where id = $1', [id]);
  return rows[0] ? mapPropertyRow(rows[0]) : null;
}

export async function getDevelopmentById(id: string): Promise<Development | null> {
  const devRows = await query<DevelopmentRow>('select * from developments where id = $1', [id]);
  if (!devRows[0]) return null;
  const unitRows = await query<PropertyRow>(
    'select * from properties where empreendimento_id = $1 order by area asc nulls last',
    [id]
  );
  return mapDevelopmentRow(devRows[0], unitRows.map(mapPropertyRow));
}

export async function getAllDevelopments(): Promise<Development[]> {
  const devRows = await query<DevelopmentRow>('select * from developments order by delivery_date asc');
  const results: Development[] = [];
  for (const dev of devRows) {
    const unitRows = await query<PropertyRow>('select * from properties where empreendimento_id = $1', [dev.id]);
    results.push(mapDevelopmentRow(dev, unitRows.map(mapPropertyRow)));
  }
  return results;
}

export async function getPropertiesByCorretor(email: string, isAdmin: boolean): Promise<PropertyDetail[]> {
  const rows = isAdmin
    ? await query<PropertyRow>('select * from properties where corretor_email is not null order by created_at desc')
    : await query<PropertyRow>('select * from properties where corretor_email = $1 order by created_at desc', [email]);
  return rows.map(mapPropertyRow);
}

export async function getAllPropertyIds(): Promise<string[]> {
  const rows = await query<{ id: string }>('select id from properties');
  return rows.map((r) => r.id);
}

export async function getAllDevelopmentIds(): Promise<string[]> {
  const rows = await query<{ id: string }>('select id from developments');
  return rows.map((r) => r.id);
}

// ---------------- Cadastro (painel) — escrita ----------------
export type CreatePropertyInput = {
  id: string;
  titulo?: string;
  tipoUnidade: TipoUnidade;
  finalidade: 'venda' | 'aluguel';
  deliveryDate: string; // "AAAA-MM"
  priceValue: number;
  pricePeriod: 'unico' | 'mensal';
  location: string;
  quartos?: number;
  vagas?: number;
  banheiros?: number;
  escaninhos?: number;
  area?: number;
  video: boolean;
  videoUrl?: string;
  aceitaTemporada: boolean;
  description: string;
  amenities: string[];
  empreendimentoId?: string;
  corretorEmail: string;
  photos?: string[];
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  condominio?: string;
};

// Aceita só fotos do nosso próprio armazenamento (R2) — nunca link de terceiros
function sanitizePhotos(photos: string[] | undefined): string[] {
  const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '').replace(/^https?:\/\//, '');
  return (photos ?? [])
    .filter((u) => typeof u === 'string' && /^https:\/\//.test(u) && (!base || u.replace(/^https:\/\//, '').startsWith(base)))
    .slice(0, 60);
}

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function createProperty(input: CreatePropertyInput): Promise<void> {
  await query(
    `insert into properties
      (id, titulo, tipo_unidade, finalidade, delivery_date, price_value, price_period, location, quartos, vagas, banheiros, escaninhos, area, video, video_url, aceita_temporada, match_score, description, amenities, empreendimento_id, corretor_email,
       photos, cep, logradouro, bairro, cidade, uf, condominio)
     values ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,50,$17,$18::jsonb,$19,$20,$21::jsonb,$22,$23,$24,$25,$26,$27)`,
    [
      input.id,
      input.titulo ?? null,
      input.tipoUnidade,
      input.finalidade,
      `${input.deliveryDate}-01`,
      input.priceValue,
      input.pricePeriod,
      input.location,
      input.quartos ?? null,
      input.vagas ?? null,
      input.banheiros ?? null,
      input.escaninhos ?? null,
      input.area ?? null,
      input.video,
      input.videoUrl ?? null,
      input.aceitaTemporada,
      input.description,
      JSON.stringify(input.amenities),
      input.empreendimentoId ?? null,
      input.corretorEmail,
      JSON.stringify(sanitizePhotos(input.photos)),
      clean(input.cep?.replace(/\D/g, '')),
      clean(input.logradouro),
      clean(input.bairro),
      clean(input.cidade),
      clean(input.uf?.toUpperCase()),
      clean(input.condominio)
    ]
  );
}

export type CreateDevelopmentInput = {
  id: string;
  name: string;
  location: string;
  deliveryDate: string;
  description: string;
  tipo: 'vertical' | 'horizontal';
  pavimentos?: number;
  areaTerreno?: string;
  amenities: string[];
  aceitaTemporada: boolean;
  videoUrl?: string;
  corretorEmail: string;
  heroHeight?: number;
  photos?: string[];
  tiposUnidade?: TipoUnidade[];
  quartosOpcoes?: number[];
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

export async function createDevelopment(input: CreateDevelopmentInput): Promise<void> {
  await query(
    `insert into developments
      (id, name, location, delivery_date, description, tipo, pavimentos, area_terreno, amenities, aceita_temporada, hero_height, video_url, corretor_email,
       photos, tipos_unidade, quartos_opcoes, cep, logradouro, bairro, cidade, uf)
     values ($1,$2,$3,$4::date,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19,$20,$21)`,
    [
      input.id,
      input.name,
      input.location,
      `${input.deliveryDate}-01`,
      input.description,
      input.tipo,
      input.pavimentos ?? null,
      input.areaTerreno ?? null,
      JSON.stringify(input.amenities),
      input.aceitaTemporada,
      input.heroHeight ?? 300,
      input.videoUrl ?? null,
      input.corretorEmail,
      JSON.stringify(sanitizePhotos(input.photos)),
      JSON.stringify(Array.from(new Set((input.tiposUnidade ?? []).filter((t) => t in TIPO_UNIDADE_LABEL)))),
      JSON.stringify(Array.from(new Set((input.quartosOpcoes ?? []).filter((n) => Number.isInteger(n) && n > 0 && n < 20))).sort((a, b) => a - b)),
      clean(input.cep?.replace(/\D/g, '')),
      clean(input.logradouro),
      clean(input.bairro),
      clean(input.cidade),
      clean(input.uf?.toUpperCase())
    ]
  );
}

export async function deleteProperty(id: string): Promise<void> {
  await query('delete from properties where id = $1', [id]);
}

// ---------------- Login da equipe ----------------
export async function staffLogin(email: string, password: string): Promise<StaffSessionPayload | null> {
  const rows = await query<{ email: string; name: string; role: 'admin' | 'corretor'; password_hash: string }>(
    'select email, name, role, password_hash from staff_users where email = $1',
    [email]
  );
  const user = rows[0];
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  const payload: StaffSessionPayload = { email: user.email, name: user.name, role: user.role };
  cookies().set(STAFF_COOKIE, signSession(payload), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
  return payload;
}

export async function staffLogout(): Promise<void> {
  cookies().delete(STAFF_COOKIE);
}

export async function getStaffSession(): Promise<StaffSessionPayload | null> {
  return verifySession(cookies().get(STAFF_COOKIE)?.value);
}

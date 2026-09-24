'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { query } from './db';
import { mapPropertyRow, mapDevelopmentRow, heightFromId, toStringArray, type PropertyRow, type DevelopmentRow } from './db-mappers';
import { signSession, verifySession, type StaffSessionPayload } from './session';
import type { PropertyDetail, Development } from './property-details';
import type { FilterState } from './filters';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from './tipologias';
import { r2PublicBase, cleanPhotoUrl } from './r2-url';
import { formatTitulo } from './text';
import { enviarEmail, emailConfigurado, emailLayout, escapeHtml } from './email';
import { SITE_URL } from './seo';
import { chaveLinkPrivado } from './session';

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

export async function getFeedPage(page: number, filters: FilterState, opcoes?: { ocultos?: boolean }): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const ocultos = !!opcoes?.ocultos;
  const params: unknown[] = [];
  const p = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  const propConds: string[] = [];
  const devConds: string[] = [];

  // ---- Condições dos imóveis (alias p, com o empreendimento em d) ----
  if (filters.finalidade !== 'todas') propConds.push(`p.finalidade = ${p(filters.finalidade)}`);
  const tipos = (filters.tipos ?? []).filter((t) => t in TIPO_UNIDADE_LABEL);
  const precoMin = filters.precoMin && filters.precoMin > 0 ? filters.precoMin : null;
  const precoMax = filters.precoMax && filters.precoMax > 0 ? filters.precoMax : null;
  const areaMin = filters.areaMin && filters.areaMin > 0 ? filters.areaMin : null;
  const areaMax = filters.areaMax && filters.areaMax > 0 ? filters.areaMax : null;
  if (tipos.length) propConds.push(`p.tipo_unidade = any(${p(tipos)}::text[])`);
  if (precoMin) propConds.push(`p.price_value >= ${p(precoMin)}`);
  if (precoMax) propConds.push(`p.price_value <= ${p(precoMax)}`);
  if (areaMin) propConds.push(`p.area >= ${p(areaMin)}`);
  if (areaMax) propConds.push(`p.area <= ${p(areaMax)}`);
  if (filters.quartosMin !== 'todas') propConds.push(`p.quartos >= ${p(filters.quartosMin)}`);
  if (filters.vagasMin !== 'todas') propConds.push(`p.vagas >= ${p(filters.vagasMin)}`);
  if (filters.aceitaTemporada === 'sim') propConds.push('p.aceita_temporada = true');
  if (filters.modo === 'lancamentos') propConds.push('p.empreendimento_id is null and p.delivery_date > now()');

  // ---- Condições dos empreendimentos (alias d, resumo das unidades em u) ----
  if (filters.finalidade === 'aluguel') devConds.push('false');
  if (tipos.length) {
    const t = p(tipos);
    devConds.push(`(d.tipos_unidade ?| ${t}::text[] or coalesce(u.tipos, '[]'::jsonb) ?| ${t}::text[])`);
  }
  // Empreendimento entra se alguma tipologia cai dentro da faixa pedida
  if (precoMin) devConds.push(`u.max_price >= ${p(precoMin)}`);
  if (precoMax) devConds.push(`u.min_price <= ${p(precoMax)}`);
  if (areaMin) devConds.push(`u.max_area >= ${p(areaMin)}`);
  if (areaMax) devConds.push(`u.min_area <= ${p(areaMax)}`);
  if (filters.quartosMin !== 'todas') devConds.push(`greatest(u.max_quartos, dq.max_quartos) >= ${p(filters.quartosMin)}`);
  if (filters.vagasMin !== 'todas') devConds.push(`u.max_vagas >= ${p(filters.vagasMin)}`);
  if (filters.aceitaTemporada === 'sim') devConds.push('d.aceita_temporada = true');
  // Só condomínios publicados; as tipologias da tabela de vendas aparecem dentro do card do empreendimento
  devConds.push("d.status = 'publicado' and d.delivery_date is not null");
  // Condomínio sem fotos e sem nenhum imóvel/tipologia não entra no feed geral —
  // só aparece quando a pessoa pesquisa (por local ou palavra-chave).
  const pesquisando = (filters.termos ?? []).length > 0 || (filters.locais ?? []).length > 0;
  if (!pesquisando) devConds.push("(jsonb_array_length(coalesce(d.photos, '[]'::jsonb)) > 0 or coalesce(u.n, 0) > 0)");
  propConds.push('p.is_tipologia = false');
  // Anúncios PRIVADOS (portfólio, sem autorização do proprietário para publicar)
  // não entram no feed; aparecem só mascarados na seção "reservados" no fim da busca.
  propConds.push(ocultos ? "p.visibilidade = 'privado'" : "p.visibilidade = 'publico'");
  if (ocultos) devConds.push('false');

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
  // Locais marcados (cidade / bairro / condomínio) — qualquer um deles serve
  const locais = (filters.locais ?? []).slice(0, 20);
  if (locais.length) {
    const propOr: string[] = [];
    const devOr: string[] = [];
    for (const l of locais) {
      const cid = p(l.cidade);
      const eqCid = (col: string) => `${norm(`coalesce(${col}, '')`)} = ${norm(`${cid}::text`)}`;
      if (l.tipo === 'cidade') {
        propOr.push(eqCid('p.cidade'));
        devOr.push(eqCid('d.cidade'));
      } else if (l.tipo === 'bairro') {
        const b = p(l.nome);
        propOr.push(`(${norm("coalesce(p.bairro, '')")} = ${norm(`${b}::text`)} and ${eqCid('p.cidade')})`);
        devOr.push(`(${norm("coalesce(d.bairro, '')")} = ${norm(`${b}::text`)} and ${eqCid('d.cidade')})`);
      } else {
        const n = p(l.nome);
        const nomeIgual = (col: string) => `${norm(`coalesce(${col}, '')`)} = ${norm(`${n}::text`)}`;
        if (l.id) {
          const id = p(l.id);
          propOr.push(`(p.empreendimento_id = ${id} or (${nomeIgual('p.condominio')} and ${eqCid('p.cidade')}))`);
          devOr.push(`d.id = ${id}`);
        } else {
          propOr.push(`(${nomeIgual('p.condominio')} and ${eqCid('p.cidade')})`);
          devOr.push(`(${nomeIgual('d.name')} and ${eqCid('d.cidade')})`);
        }
      }
    }
    propConds.push(`(${propOr.join(' or ')})`);
    devConds.push(`(${devOr.join(' or ')})`);
  }

  // Balões de busca: (todas as palavras do balão 1) OU (todas as palavras do balão 2) ...
  const grupos = (filters.termos ?? []).map(searchTokens).filter((g) => g.length);
  if (grupos.length) {
    const propOr: string[] = [];
    const devOr: string[] = [];
    for (const tokens of grupos) {
      const vs = tokens.map((t) => p(`%${t}%`));
      propOr.push(`(${vs.map((v) => `pt.txt like ${v}`).join(' and ')})`);
      devOr.push(`(${vs.map((v) => `dx.txt like ${v}`).join(' and ')})`);
    }
    propConds.push(`(${propOr.join(' or ')})`);
    devConds.push(`(${devOr.join(' or ')})`);
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
                  max(x.price_value) as max_price,
                  min(x.area) as min_area,
                  max(x.area) as max_area,
                  max(x.quartos) as max_quartos,
                  max(x.vagas) as max_vagas,
                  jsonb_agg(distinct x.tipo_unidade) as tipos,
                  count(x.id) as n,
                  string_agg(distinct xtl.label, ' ') as tipos_texto
             from properties x left join tl xtl on xtl.k = x.tipo_unidade
            where x.empreendimento_id = d.id and x.visibilidade = 'publico'
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
           from properties x where x.empreendimento_id = d.id and x.visibilidade = 'publico'
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

// ---------------- Índice de locais para a busca ----------------
// Só lugares onde EXISTE anúncio publicado (a lista cresce sozinha conforme
// os cadastros entram). Agrupa grafias diferentes ("Goiania"/"Goiânia").
export type LocalSugestao = {
  tipo: 'cidade' | 'bairro' | 'condominio';
  nome: string;
  cidade: string;
  uf: string;
  id?: string; // condomínio cadastrado (empreendimento)
  total: number;
};

export async function getLocationIndex(): Promise<LocalSugestao[]> {
  const rows = await query<{ tipo: 'cidade' | 'bairro' | 'condominio'; nome: string; cidade: string; uf: string | null; id: string | null; total: string }>(
    `with anuncios as (
       select p.bairro, p.cidade, p.uf, coalesce(pd.name, p.condominio) as condominio, pd.id as dev_id
         from properties p left join developments pd on pd.id = p.empreendimento_id
        where p.is_tipologia = false and p.cidade is not null
       union all
       select d.bairro, d.cidade, d.uf, d.name, d.id
         from developments d where d.status = 'publicado' and d.delivery_date is not null and d.cidade is not null
     ),
     cidades as (
       select 'cidade' as tipo, mode() within group (order by cidade) as nome, mode() within group (order by cidade) as cidade,
              max(uf) as uf, null::text as id, count(*) as total
         from anuncios group by ${norm('cidade')}
     ),
     bairros as (
       select 'bairro' as tipo, mode() within group (order by bairro) as nome, mode() within group (order by cidade) as cidade,
              max(uf) as uf, null::text as id, count(*) as total
         from anuncios where bairro is not null group by ${norm('bairro')}, ${norm('cidade')}
     ),
     condos as (
       select 'condominio' as tipo, mode() within group (order by condominio) as nome, mode() within group (order by cidade) as cidade,
              max(uf) as uf, max(dev_id) as id, count(*) as total
         from anuncios where condominio is not null group by ${norm('condominio')}, ${norm('cidade')}
     )
     select * from cidades union all select * from bairros union all select * from condos
     order by total desc`
  );
  return rows.map((r) => ({ tipo: r.tipo, nome: formatTitulo(r.nome), cidade: r.cidade, uf: r.uf ?? '', id: r.id ?? undefined, total: Number(r.total) || 0 }));
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

// ---------------- Sessão da equipe (servidor) ----------------
function currentStaff(): StaffSessionPayload | null {
  return verifySession(cookies().get(STAFF_COOKIE)?.value);
}
function requireStaff(): StaffSessionPayload {
  const staff = currentStaff();
  if (!staff) throw new Error('Sessão da equipe expirada — faça login novamente no painel.');
  return staff;
}
// Admin mexe em tudo; corretor só no que ele mesmo cadastrou
async function assertCanEdit(table: 'properties' | 'developments', id: string, staff: StaffSessionPayload) {
  if (staff.role === 'admin') return;
  const rows = await query<{ corretor_email: string | null }>(`select corretor_email from ${table} where id = $1`, [id]);
  if (!rows[0] || rows[0].corretor_email !== staff.email) throw new Error('Você só pode editar o que cadastrou.');
}

// ---------------- Leitura para as páginas públicas ----------------
// Anúncio privado só volta completo para a equipe ou com a chave do link privado
export async function getPropertyById(id: string, chave?: string): Promise<PropertyDetail | null> {
  const rows = await query<PropertyRow>('select * from properties where id = $1', [id]);
  const r = rows[0];
  if (!r) return null;
  if (r.visibilidade === 'privado' && !currentStaff() && chave !== chaveLinkPrivado(id)) return null;
  return mapPropertyRow(r);
}

// Condomínio em rascunho só aparece para quem está logado no painel
export async function getDevelopmentById(id: string): Promise<Development | null> {
  const devRows = await query<DevelopmentRow>('select * from developments where id = $1', [id]);
  const dev = devRows[0];
  if (!dev) return null;
  if (dev.status === 'rascunho' && !currentStaff()) return null;
  const unitRows = await query<PropertyRow>(
    "select * from properties where empreendimento_id = $1 and visibilidade = 'publico' order by is_tipologia desc, area asc nulls last",
    [id]
  );
  return mapDevelopmentRow(dev, unitRows.map(mapPropertyRow));
}

export async function getPropertiesByCorretor(email: string, isAdmin: boolean): Promise<PropertyDetail[]> {
  const staff = requireStaff();
  const rows =
    staff.role === 'admin' && isAdmin
      ? await query<PropertyRow>('select * from properties where corretor_email is not null and is_tipologia = false order by created_at desc')
      : await query<PropertyRow>('select * from properties where corretor_email = $1 and is_tipologia = false order by created_at desc', [staff.email]);
  return rows.map(mapPropertyRow);
}

export async function getAllPropertyIds(): Promise<string[]> {
  const rows = await query<{ id: string }>('select id from properties');
  return rows.map((r) => r.id);
}

export async function getAllDevelopmentIds(): Promise<string[]> {
  const rows = await query<{ id: string }>("select id from developments where status = 'publicado'");
  return rows.map((r) => r.id);
}

// ---------------- Relacionados (fim das páginas) ----------------
// "Imóveis disponíveis neste condomínio" e "Imóveis nesta região".
// Região = mesma cidade, mesma finalidade, mesmo grupo de tipo (apartamentos
// com apartamentos, casas com casas...), preço até 35% abaixo ou acima.
// Dentro disso, ordena pelo PERFIL do imóvel que a pessoa está vendo:
// quantidade de quartos pesa mais, depois metragem parecida, depois mesmo
// bairro e preço mais próximo. A idade do imóvel não conta (de propósito:
// um usado bem parecido pode ser uma ótima sugestão para quem olha um novo).
export type RelatedListings = { mesmoCondominio: PropertyDetail[]; regiao: PropertyDetail[]; precoReferencia: number | null };

const GRUPO_TIPO: Record<string, string> = {
  studio: 'vertical', flat: 'vertical', loft: 'vertical', apartamento: 'vertical', apartamento_garden: 'vertical',
  apartamento_duplex: 'vertical', apartamento_triplex: 'vertical', cobertura: 'vertical', cobertura_duplex: 'vertical', penthouse: 'vertical',
  casa: 'casa', casa_condominio: 'casa', sobrado: 'casa',
  chacara_sitio_fazenda: 'terra', terreno_lote: 'terra',
  sala_comercial: 'comercial', loja_ponto_comercial: 'comercial', galpao: 'comercial', predio_comercial: 'comercial'
};
const MARGEM_PRECO = 0.35;

export async function getRelatedListings(target: { propertyId?: string; developmentId?: string }): Promise<RelatedListings> {
  type Base = { id?: string; devId: string | null; condominio: string | null; bairro: string | null; cidade: string | null; finalidade: string; price: number | null; quartos: number | null; area: number | null; grupos: string[] };
  let base: Base | null = null;
  const vazio: RelatedListings = { mesmoCondominio: [], regiao: [], precoReferencia: null };

  if (target.propertyId) {
    const r = await query<{ id: string; empreendimento_id: string | null; condominio: string | null; bairro: string | null; cidade: string | null; finalidade: string; price_value: string; quartos: number | null; area: string | null; tipo_unidade: string }>(
      'select id, empreendimento_id, condominio, bairro, cidade, finalidade, price_value, quartos, area, tipo_unidade from properties where id = $1',
      [target.propertyId]
    );
    if (!r[0]) return vazio;
    base = {
      id: r[0].id, devId: r[0].empreendimento_id, condominio: r[0].condominio, bairro: r[0].bairro, cidade: r[0].cidade, finalidade: r[0].finalidade,
      price: Number(r[0].price_value) || null, quartos: r[0].quartos, area: r[0].area != null ? Number(r[0].area) : null,
      grupos: [GRUPO_TIPO[r[0].tipo_unidade] ?? 'vertical']
    };
  } else if (target.developmentId) {
    const r = await query<{ id: string; name: string; bairro: string | null; cidade: string | null; tipos_unidade: unknown; min_price: string | null; q: string | null; a: string | null; unit_tipos: unknown }>(
      `select d.id, d.name, d.bairro, d.cidade, d.tipos_unidade,
              (select min(price_value) filter (where price_value > 0) from properties where empreendimento_id = d.id) as min_price,
              (select round(avg(quartos)) from properties where empreendimento_id = d.id) as q,
              (select avg(area) from properties where empreendimento_id = d.id) as a,
              (select jsonb_agg(distinct tipo_unidade) from properties where empreendimento_id = d.id) as unit_tipos
         from developments d where d.id = $1`,
      [target.developmentId]
    );
    if (!r[0]) return vazio;
    const tipos = [...toStringArray(r[0].tipos_unidade), ...toStringArray(r[0].unit_tipos)];
    base = {
      devId: r[0].id, condominio: r[0].name, bairro: r[0].bairro, cidade: r[0].cidade, finalidade: 'venda',
      price: r[0].min_price ? Number(r[0].min_price) : null, quartos: r[0].q ? Number(r[0].q) : null, area: r[0].a ? Number(r[0].a) : null,
      grupos: Array.from(new Set(tipos.map((t) => GRUPO_TIPO[t]).filter(Boolean)))
    };
  }
  if (!base) return vazio;

  // Mesmo condomínio: vinculados ao empreendimento ou com o mesmo nome de condomínio na mesma cidade
  const condoRows = await query<PropertyRow>(
    `select * from properties
      where is_tipologia = false and visibilidade = 'publico' and id <> $1
        and (($2::text is not null and empreendimento_id = $2)
          or ($3::text is not null and ${norm('condominio')} = ${norm('$3::text')} and ${norm("coalesce(cidade, '')")} = ${norm("coalesce($4::text, '')")}))
      order by created_at desc limit 12`,
    [base.id ?? '', base.devId, base.condominio, base.cidade]
  );
  if (!base.cidade) return { mesmoCondominio: condoRows.map(mapPropertyRow), regiao: [], precoReferencia: base.price };

  const excluir = [base.id ?? '', ...condoRows.map((r) => r.id)];
  const tiposDoGrupo = Object.entries(GRUPO_TIPO)
    .filter(([, g]) => !base!.grupos.length || base!.grupos.includes(g))
    .map(([t]) => t);

  const params: unknown[] = [excluir, base.cidade, base.bairro, base.finalidade, tiposDoGrupo];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const conds = [
    'is_tipologia = false',
    "visibilidade = 'publico'",
    'not (id = any($1::text[]))',
    `${norm("coalesce(cidade, '')")} = ${norm('$2::text')}`,
    'finalidade = $4',
    'tipo_unidade = any($5::text[])'
  ];
  const score: string[] = [`(case when ${norm("coalesce(bairro, '')")} = ${norm("coalesce($3::text, '')")} then 0 else 1 end)`];
  if (base.price) {
    const pr = p(base.price);
    conds.push(`price_value between ${pr} * ${1 - MARGEM_PRECO} and ${pr} * ${1 + MARGEM_PRECO}`);
    score.push(`abs(price_value - ${pr}) / ${pr} * 2`);
  }
  if (base.quartos) {
    const q = p(base.quartos);
    score.push(`coalesce(abs(quartos - ${q}), 2) * 3`); // cada quarto de diferença pesa muito
  }
  if (base.area) {
    const a = p(base.area);
    score.push(`coalesce(abs(area - ${a}) / ${a}, 0.5) * 4`); // 25% de diferença na metragem ≈ 1 quarto
  }
  const regiaoRows = await query<PropertyRow>(
    `select * from properties where ${conds.join(' and ')} order by (${score.join(' + ')}) asc, created_at desc limit 8`,
    params
  );
  return { mesmoCondominio: condoRows.map(mapPropertyRow), regiao: regiaoRows.map(mapPropertyRow), precoReferencia: base.price };
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
  videoVertical?: boolean; // vídeo gravado em pé (celular) — ocupa o espaço sem faixas pretas
  aceitaTemporada: boolean;
  description: string;
  amenities: string[];
  empreendimentoId?: string;
  corretorEmail?: string; // ignorado — o corretor vem sempre do login
  photos?: string[];
  plantas?: string[]; // imagens da planta da unidade (duplex pode ter 2: inferior e superior)
  // 'privado' = anúncio do nosso portfólio que o proprietário não autorizou publicar:
  // fica fora do feed, mostra só um resumo e o anúncio completo só pelo link privado.
  visibilidade?: 'publico' | 'privado';
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  condominio?: string;
  isTipologia?: boolean;
};
export type PropertyFields = Omit<CreatePropertyInput, 'id' | 'corretorEmail' | 'isTipologia'>;

// Aceita só fotos do nosso próprio armazenamento (R2) — nunca link de terceiros
function sanitizePhotos(photos: string[] | undefined): string[] {
  const base = r2PublicBase();
  return (photos ?? [])
    .filter((u) => typeof u === 'string')
    .map(cleanPhotoUrl)
    .filter((u) => /^https:\/\//.test(u) && (!base || u.startsWith(`${base}/`)))
    .slice(0, 60);
}

const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);

function propertyValues(input: PropertyFields) {
  return [
    input.titulo ? formatTitulo(input.titulo) : null,
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
    JSON.stringify(sanitizePhotos(input.photos)),
    clean(input.cep?.replace(/\D/g, '')),
    clean(input.logradouro),
    clean(input.bairro),
    clean(input.cidade),
    clean(input.uf?.toUpperCase()),
    clean(input.condominio ? formatTitulo(input.condominio) : undefined),
    !!input.videoVertical,
    JSON.stringify(sanitizePhotos(input.plantas)),
    input.visibilidade === 'privado' ? 'privado' : 'publico'
  ];
}
const PROPERTY_COLS =
  'titulo, tipo_unidade, finalidade, delivery_date, price_value, price_period, location, quartos, vagas, banheiros, escaninhos, area, video, video_url, aceita_temporada, description, amenities, empreendimento_id, photos, cep, logradouro, bairro, cidade, uf, condominio, video_vertical, plantas, visibilidade';
const PROPERTY_CASTS = ['', '', '', '::date', '', '', '', '', '', '', '', '', '', '', '', '', '::jsonb', '', '::jsonb', '', '', '', '', '', '', '', '::jsonb', ''];

export async function createProperty(input: CreatePropertyInput): Promise<void> {
  const staff = requireStaff();
  const values = propertyValues(input);
  const placeholders = values.map((_, i) => `$${i + 4}${PROPERTY_CASTS[i]}`).join(',');
  await query(
    `insert into properties (id, corretor_email, is_tipologia, match_score, ${PROPERTY_COLS}) values ($1, $2, $3, 50, ${placeholders})`,
    [input.id, staff.email, !!input.isTipologia, ...values]
  );
  if (!input.isTipologia) await avisarInteressados(input.id).catch((err) => console.error('Aviso a interessados falhou', err));
}

export async function updateProperty(id: string, input: PropertyFields): Promise<void> {
  const staff = requireStaff();
  await assertCanEdit('properties', id, staff);
  const values = propertyValues(input);
  const sets = PROPERTY_COLS.split(', ')
    .map((col, i) => `${col} = $${i + 2}${PROPERTY_CASTS[i]}`)
    .join(', ');
  await query(`update properties set ${sets} where id = $1`, [id, ...values]);
}

// Nada se perde: antes de sair do ar (excluído ou vendido), o anúncio vai para
// o histórico — base das médias de mercado e do preço do m² por bairro.
async function arquivarNoHistorico(id: string, motivo: 'excluido' | 'vendido', valorVenda?: number | null) {
  await query(
    `insert into imoveis_historico (property_id, motivo, titulo, tipo_unidade, finalidade, price_value, valor_venda, area, quartos, vagas,
        bairro, cidade, uf, condominio, empreendimento_id, delivery_date, visibilidade, corretor_email, anunciado_em, dados)
     select p.id, $2, p.titulo, p.tipo_unidade, p.finalidade, p.price_value, $3, p.area, p.quartos, p.vagas,
        p.bairro, p.cidade, p.uf, coalesce(d.name, p.condominio), p.empreendimento_id, p.delivery_date, p.visibilidade, p.corretor_email, p.created_at, to_jsonb(p)
       from properties p left join developments d on d.id = p.empreendimento_id
      where p.id = $1 and p.is_tipologia = false`,
    [id, motivo, valorVenda && valorVenda > 0 ? valorVenda : null]
  );
}

export async function deleteProperty(id: string): Promise<void> {
  const staff = requireStaff();
  await assertCanEdit('properties', id, staff);
  await arquivarNoHistorico(id, 'excluido');
  await query('delete from favorites where property_id = $1', [id]).catch(() => {});
  await query('delete from properties where id = $1', [id]);
}

// Só anúncio avulso pode ser marcado como vendido (sai do ar e fica no histórico)
export async function marcarComoVendido(id: string, valorVenda?: number): Promise<void> {
  const staff = requireStaff();
  await assertCanEdit('properties', id, staff);
  const r = await query<{ is_tipologia: boolean }>('select is_tipologia from properties where id = $1', [id]);
  if (!r[0] || r[0].is_tipologia) throw new Error('Só anúncio avulso pode ser marcado como vendido.');
  await arquivarNoHistorico(id, 'vendido', valorVenda ?? null);
  await query('delete from favorites where property_id = $1', [id]).catch(() => {});
  await query('delete from properties where id = $1', [id]);
}

// Link privado (para mandar ao cliente) de um anúncio oculto
export async function getLinkPrivado(id: string): Promise<string> {
  const staff = requireStaff();
  await assertCanEdit('properties', id, staff);
  return `${SITE_URL}/imovel/${id}?k=${chaveLinkPrivado(id)}`;
}

// ---------------- Anúncios reservados (privados), mascarados ----------------
export type AnuncioOculto = {
  id: string;
  tipoUnidade: TipoUnidade;
  finalidade: 'venda' | 'aluguel';
  bairro: string | null;
  cidade: string | null;
  quartos: number | null;
  vagas: number | null;
  area: number | null;
  preco: number | null;
  precoM2: number | null;
  condominio?: string | null;
};

function mascarar(r: PropertyRow, comCondominio = false): AnuncioOculto {
  const area = r.area != null ? Number(r.area) : null;
  const preco = Number(r.price_value) || null;
  return {
    id: r.id,
    tipoUnidade: r.tipo_unidade as TipoUnidade,
    finalidade: r.finalidade,
    bairro: r.bairro ?? null,
    cidade: r.cidade ?? null,
    quartos: r.quartos ?? null,
    vagas: r.vagas ?? null,
    area,
    preco,
    precoM2: preco && area && r.finalidade === 'venda' ? Math.round(preco / area) : null,
    condominio: comCondominio ? (r.condominio ? formatTitulo(r.condominio) : null) : undefined
  };
}

/** Resumos dos anúncios privados que atendem a mesma busca do feed */
export async function getAnunciosOcultos(filters: FilterState): Promise<AnuncioOculto[]> {
  const { items } = await getFeedPage(0, filters, { ocultos: true });
  const ids = items.filter((i) => i.kind === 'imovel').map((i) => (i as { property: { id: string } }).property.id);
  if (!ids.length) return [];
  const rows = await query<PropertyRow>('select * from properties where id = any($1::text[])', [ids]);
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)).filter(Boolean).slice(0, 12).map((r) => mascarar(r!));
}

/** Privados de um condomínio (página do condomínio) */
export async function getOcultosDoCondominio(developmentId: string, nome: string, cidade?: string | null): Promise<AnuncioOculto[]> {
  const rows = await query<PropertyRow>(
    `select * from properties
      where is_tipologia = false and visibilidade = 'privado'
        and (empreendimento_id = $1 or (${norm('condominio')} = ${norm('$2::text')} and ${norm("coalesce(cidade, '')")} = ${norm("coalesce($3::text, '')")}))
      order by created_at desc limit 12`,
    [developmentId, nome, cidade ?? null]
  );
  return rows.map((r) => mascarar(r, true));
}

/** Resumo para a página de um anúncio privado (sem título, fotos ou descrição) */
export async function getResumoOculto(id: string): Promise<AnuncioOculto | null> {
  const rows = await query<PropertyRow>("select * from properties where id = $1 and visibilidade = 'privado'", [id]);
  return rows[0] ? mascarar(rows[0], true) : null;
}

// Dados crus para preencher o formulário de edição
export type PropertyEditData = PropertyFields & { id: string; corretorEmail: string | null };

export async function getPropertyForEdit(id: string): Promise<PropertyEditData | null> {
  const staff = requireStaff();
  await assertCanEdit('properties', id, staff);
  const rows = await query<PropertyRow & { price_value: string; delivery_date: string | Date }>('select * from properties where id = $1', [id]);
  const r = rows[0];
  if (!r) return null;
  const d = r.delivery_date instanceof Date ? r.delivery_date.toISOString() : String(r.delivery_date);
  return {
    id: r.id,
    corretorEmail: r.corretor_email,
    titulo: r.titulo ?? undefined,
    tipoUnidade: r.tipo_unidade as TipoUnidade,
    finalidade: r.finalidade,
    deliveryDate: d.slice(0, 7),
    priceValue: Number(r.price_value) || 0,
    pricePeriod: r.price_period,
    location: r.location,
    quartos: r.quartos ?? undefined,
    vagas: r.vagas ?? undefined,
    banheiros: r.banheiros ?? undefined,
    escaninhos: r.escaninhos ?? undefined,
    area: r.area != null ? Number(r.area) : undefined,
    video: r.video,
    videoUrl: r.video_url ?? undefined,
    videoVertical: !!r.video_vertical,
    aceitaTemporada: r.aceita_temporada,
    description: r.description,
    amenities: toStringArray(r.amenities),
    empreendimentoId: r.empreendimento_id ?? undefined,
    photos: toStringArray(r.photos),
    plantas: toStringArray(r.plantas),
    visibilidade: r.visibilidade === 'privado' ? 'privado' : 'publico',
    cep: r.cep ?? undefined,
    logradouro: r.logradouro ?? undefined,
    bairro: r.bairro ?? undefined,
    cidade: r.cidade ?? undefined,
    uf: r.uf ?? undefined,
    condominio: r.condominio ?? undefined
  };
}

// ---------------- Condomínios / empreendimentos ----------------
export type DevelopmentStatus = 'rascunho' | 'publicado';

export type DevelopmentFields = {
  name: string;
  location: string;
  deliveryDate?: string; // "AAAA-MM" — obrigatório só para publicar
  description: string;
  tipo: 'vertical' | 'horizontal';
  pavimentos?: number;
  areaTerreno?: string;
  amenities: string[];
  aceitaTemporada: boolean;
  videoUrl?: string;
  videoVertical?: boolean;
  heroHeight?: number;
  photos?: string[];
  tiposUnidade?: TipoUnidade[];
  quartosOpcoes?: number[];
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  status?: DevelopmentStatus;
};
export type CreateDevelopmentInput = DevelopmentFields & { id: string; corretorEmail?: string };

// O que falta para um condomínio poder ser publicado (vazio = pode publicar)
export async function pendenciasParaPublicar(f: DevelopmentFields): Promise<string[]> {
  const faltando: string[] = [];
  if (!f.name?.trim()) faltando.push('nome');
  if (!f.bairro?.trim() || !f.cidade?.trim()) faltando.push('endereço (bairro e cidade)');
  if (!f.deliveryDate) faltando.push('data de entrega');
  // Narrativa, tipos, fotos e lazer são opcionais — dá para publicar e completar depois
  return faltando;
}

function developmentValues(input: DevelopmentFields) {
  return [
    formatTitulo(input.name),
    input.location,
    input.deliveryDate ? `${input.deliveryDate}-01` : null,
    input.description,
    input.tipo,
    input.pavimentos ?? null,
    input.areaTerreno ?? null,
    JSON.stringify(input.amenities),
    input.aceitaTemporada,
    input.heroHeight ?? 300,
    input.videoUrl ?? null,
    JSON.stringify(sanitizePhotos(input.photos)),
    JSON.stringify(Array.from(new Set((input.tiposUnidade ?? []).filter((t) => t in TIPO_UNIDADE_LABEL)))),
    JSON.stringify(Array.from(new Set((input.quartosOpcoes ?? []).filter((n) => Number.isInteger(n) && n > 0 && n < 20))).sort((a, b) => a - b)),
    clean(input.cep?.replace(/\D/g, '')),
    clean(input.logradouro),
    clean(input.bairro),
    clean(input.cidade),
    clean(input.uf?.toUpperCase()),
    input.status === 'rascunho' ? 'rascunho' : 'publicado',
    !!input.videoVertical
  ];
}
const DEV_COLS =
  'name, location, delivery_date, description, tipo, pavimentos, area_terreno, amenities, aceita_temporada, hero_height, video_url, photos, tipos_unidade, quartos_opcoes, cep, logradouro, bairro, cidade, uf, status, video_vertical';
const DEV_CASTS = ['', '', '::date', '', '', '', '', '::jsonb', '', '', '', '::jsonb', '::jsonb', '::jsonb', '', '', '', '', '', '', ''];

export async function createDevelopment(input: CreateDevelopmentInput): Promise<{ ok: true } | { ok: false; faltando: string[] }> {
  const staff = requireStaff();
  if (input.status !== 'rascunho') {
    const faltando = await pendenciasParaPublicar(input);
    if (faltando.length) return { ok: false, faltando };
  }
  const values = developmentValues(input);
  const placeholders = values.map((_, i) => `$${i + 3}${DEV_CASTS[i]}`).join(',');
  await query(`insert into developments (id, corretor_email, ${DEV_COLS}) values ($1, $2, ${placeholders})`, [input.id, staff.email, ...values]);
  return { ok: true };
}

export async function updateDevelopment(id: string, input: DevelopmentFields): Promise<{ ok: true } | { ok: false; faltando: string[] }> {
  const staff = requireStaff();
  await assertCanEdit('developments', id, staff);
  if (input.status !== 'rascunho') {
    const faltando = await pendenciasParaPublicar(input);
    if (faltando.length) return { ok: false, faltando };
  }
  const values = developmentValues(input);
  const sets = DEV_COLS.split(', ')
    .map((col, i) => `${col} = $${i + 2}${DEV_CASTS[i]}`)
    .join(', ');
  await query(`update developments set ${sets} where id = $1`, [id, ...values]);
  // As tipologias da tabela de vendas acompanham o endereço, as fotos e a entrega do condomínio
  if (input.deliveryDate) {
    await query(
      `update properties set location = $2, bairro = $3, cidade = $4, uf = $5, cep = $6, condominio = $7, delivery_date = $8::date, photos = $9::jsonb
        where empreendimento_id = $1 and is_tipologia = true`,
      [id, input.location, clean(input.bairro), clean(input.cidade), clean(input.uf), clean(input.cep?.replace(/\D/g, '')), input.name, `${input.deliveryDate}-01`, JSON.stringify(sanitizePhotos(input.photos))]
    );
  }
  return { ok: true };
}

// Tipologias da tabela de vendas: cria as novas, atualiza as existentes e remove as que saíram da lista
export type TipologiaInput = { id?: string; tipoUnidade: TipoUnidade; quartos?: number; vagas?: number; area?: number; priceValue: number; plantas?: string[] };

export async function saveTipologias(developmentId: string, tipologias: TipologiaInput[]): Promise<void> {
  const staff = requireStaff();
  await assertCanEdit('developments', developmentId, staff);
  const devRows = await query<DevelopmentRow>('select * from developments where id = $1', [developmentId]);
  const dev = devRows[0];
  if (!dev) throw new Error('Condomínio não encontrado.');
  const existing = await query<{ id: string }>('select id from properties where empreendimento_id = $1 and is_tipologia = true', [developmentId]);
  const keep = new Set(tipologias.map((t) => t.id).filter(Boolean) as string[]);
  for (const e of existing) if (!keep.has(e.id)) await query('delete from properties where id = $1 and is_tipologia = true', [e.id]);

  const delivery = dev.delivery_date ? (dev.delivery_date instanceof Date ? dev.delivery_date.toISOString() : String(dev.delivery_date)).slice(0, 7) : new Date().toISOString().slice(0, 7);
  for (const [i, t] of tipologias.entries()) {
    const fields: PropertyFields = {
      tipoUnidade: t.tipoUnidade,
      finalidade: 'venda',
      deliveryDate: delivery,
      priceValue: t.priceValue || 0,
      pricePeriod: 'unico',
      location: dev.location,
      quartos: t.quartos,
      vagas: t.vagas,
      area: t.area,
      video: false,
      aceitaTemporada: dev.aceita_temporada,
      description: `${TIPO_UNIDADE_LABEL[t.tipoUnidade]}${t.quartos ? ` de ${t.quartos} quartos` : ''}${t.area ? `, ${t.area} m²` : ''} no ${dev.name}, em ${dev.location}.`,
      amenities: toStringArray(dev.amenities),
      empreendimentoId: developmentId,
      photos: toStringArray(dev.photos),
      plantas: t.plantas ?? [],
      cep: dev.cep ?? undefined,
      bairro: dev.bairro ?? undefined,
      cidade: dev.cidade ?? undefined,
      uf: dev.uf ?? undefined,
      condominio: dev.name
    };
    if (t.id && existing.some((e) => e.id === t.id)) {
      const values = propertyValues(fields);
      const sets = PROPERTY_COLS.split(', ')
        .map((col, k) => `${col} = $${k + 2}${PROPERTY_CASTS[k]}`)
        .join(', ');
      await query(`update properties set ${sets} where id = $1 and is_tipologia = true`, [t.id, ...values]);
    } else {
      await createProperty({ ...fields, id: `${developmentId}-tip-${Date.now()}-${i}`, isTipologia: true });
    }
  }
}

export type DevelopmentEditData = DevelopmentFields & { id: string; tipologias: (TipologiaInput & { id: string })[] };

export async function getDevelopmentForEdit(id: string): Promise<DevelopmentEditData | null> {
  const staff = requireStaff();
  await assertCanEdit('developments', id, staff);
  const rows = await query<DevelopmentRow>('select * from developments where id = $1', [id]);
  const d = rows[0];
  if (!d) return null;
  const tips = await query<{ id: string; tipo_unidade: string; quartos: number | null; vagas: number | null; area: string | null; price_value: string; plantas: unknown }>(
    'select id, tipo_unidade, quartos, vagas, area, price_value, plantas from properties where empreendimento_id = $1 and is_tipologia = true order by area asc nulls last',
    [id]
  );
  const dd = d.delivery_date ? (d.delivery_date instanceof Date ? d.delivery_date.toISOString() : String(d.delivery_date)).slice(0, 7) : undefined;
  return {
    id: d.id,
    name: d.name,
    location: d.location,
    deliveryDate: dd,
    description: d.description,
    tipo: d.tipo,
    pavimentos: d.pavimentos ?? undefined,
    areaTerreno: d.area_terreno ?? undefined,
    amenities: toStringArray(d.amenities),
    aceitaTemporada: d.aceita_temporada,
    videoUrl: d.video_url ?? undefined,
    videoVertical: !!d.video_vertical,
    heroHeight: d.hero_height,
    photos: toStringArray(d.photos),
    tiposUnidade: toStringArray(d.tipos_unidade) as TipoUnidade[],
    quartosOpcoes: (Array.isArray(d.quartos_opcoes) ? (d.quartos_opcoes as unknown[]) : []).map(Number).filter((n) => n > 0),
    cep: d.cep ?? undefined,
    logradouro: d.logradouro ?? undefined,
    bairro: d.bairro ?? undefined,
    cidade: d.cidade ?? undefined,
    uf: d.uf ?? undefined,
    status: d.status === 'rascunho' ? 'rascunho' : 'publicado',
    tipologias: tips.map((t) => ({
      id: t.id,
      tipoUnidade: t.tipo_unidade as TipoUnidade,
      quartos: t.quartos ?? undefined,
      vagas: t.vagas ?? undefined,
      area: t.area != null ? Number(t.area) : undefined,
      priceValue: Number(t.price_value) || 0,
      plantas: toStringArray(t.plantas)
    }))
  };
}

// Lista leve para o seletor de condomínio no cadastro e para o painel
export type CondominioResumo = {
  id: string;
  name: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  logradouro: string | null;
  status: DevelopmentStatus;
  amenities: string[];
  deliveryDate: string | null;
  anuncios: number;
  tipologias: number;
  temFotos: boolean;
  corretorEmail: string | null;
  criadoEm?: string | null;
};

export async function listCondominios(): Promise<CondominioResumo[]> {
  requireStaff();
  const rows = await query<DevelopmentRow & { anuncios: string; tipologias: string }>(
    `select d.*,
            (select count(*) from properties p where p.empreendimento_id = d.id and p.is_tipologia = false) as anuncios,
            (select count(*) from properties p where p.empreendimento_id = d.id and p.is_tipologia = true) as tipologias
       from developments d order by d.name`
  );
  return rows.map((d) => ({
    id: d.id,
    name: formatTitulo(d.name),
    bairro: d.bairro ?? null,
    cidade: d.cidade ?? null,
    uf: d.uf ?? null,
    cep: d.cep ?? null,
    logradouro: d.logradouro ?? null,
    status: d.status === 'rascunho' ? 'rascunho' : 'publicado',
    amenities: toStringArray(d.amenities),
    deliveryDate: d.delivery_date ? (d.delivery_date instanceof Date ? d.delivery_date.toISOString() : String(d.delivery_date)).slice(0, 7) : null,
    anuncios: Number(d.anuncios) || 0,
    tipologias: Number(d.tipologias) || 0,
    temFotos: toStringArray(d.photos).length > 0,
    corretorEmail: d.corretor_email,
    criadoEm: (d as unknown as { created_at?: Date | string | null }).created_at ? new Date((d as unknown as { created_at: Date | string }).created_at).toISOString() : null
  }));
}

// ---------------- Interessados em condomínios ("Registre seu interesse") ----------------
export type InteresseInput = {
  developmentId?: string;
  condominio: string;
  nome: string;
  email?: string;
  telefone?: string;
  finalidade: 'venda' | 'aluguel';
  areaMin?: number;
  areaMax?: number;
  valorMax?: number;
  quartos?: number;
  mensagem?: string;
  aceitaContato: boolean;
};

export async function registrarInteresse(input: InteresseInput): Promise<{ ok: boolean; erro?: string }> {
  const nome = (input.nome ?? '').trim().slice(0, 120);
  const email = (input.email ?? '').trim().toLowerCase().slice(0, 160);
  const telefone = (input.telefone ?? '').replace(/[^\d+]/g, '').slice(0, 20);
  if (nome.length < 2) return { ok: false, erro: 'Informe seu nome.' };
  if (!email && telefone.length < 10) return { ok: false, erro: 'Informe um e-mail ou um WhatsApp com DDD.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: 'Confira o e-mail digitado.' };
  if (!input.aceitaContato) return { ok: false, erro: 'Para avisarmos você, é preciso autorizar o contato.' };
  const condominio = formatTitulo((input.condominio ?? '').slice(0, 160));
  const devId = input.developmentId && /^[\w-]{1,80}$/.test(input.developmentId) ? input.developmentId : null;

  // Evita cadastro repetido em sequência (mesma pessoa, mesmo condomínio, últimos 10 min)
  const dup = await query<{ id: string }>(
    `select id from interest_leads where condominio = $1 and ((email is not null and email = $2) or (telefone is not null and telefone = $3))
       and created_at > now() - interval '10 minutes' limit 1`,
    [condominio, email || null, telefone || null]
  );
  if (dup[0]) return { ok: true };

  const num = (n?: number) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null);
  await query(
    `insert into interest_leads (development_id, condominio, nome, email, telefone, finalidade, area_min, area_max, valor_max, quartos, mensagem, aceita_contato)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [devId, condominio, nome, email || null, telefone || null, input.finalidade === 'aluguel' ? 'aluguel' : 'venda', num(input.areaMin), num(input.areaMax), num(input.valorMax), num(input.quartos), (input.mensagem ?? '').trim().slice(0, 1000) || null, true]
  );

  // Aviso para a equipe (se o e-mail estiver configurado)
  const equipe = process.env.EMAIL_EQUIPE;
  if (equipe) {
    const linha = (rotulo: string, valor?: string | number | null) =>
      valor ? `<tr><td style="padding:4px 12px 4px 0;color:#6b6f76">${rotulo}</td><td style="padding:4px 0"><strong>${escapeHtml(String(valor))}</strong></td></tr>` : '';
    const brl = (n?: number) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);
    await enviarEmail(
      equipe,
      `Novo interessado no ${condominio}`,
      emailLayout(
        `Novo interessado no ${escapeHtml(condominio)}`,
        `<table style="font-size:14px">${linha('Nome', nome)}${linha('WhatsApp', telefone)}${linha('E-mail', email)}${linha('Quer', input.finalidade === 'aluguel' ? 'Alugar' : 'Comprar')}${linha('Metragem', input.areaMin || input.areaMax ? `${input.areaMin ?? '?'} a ${input.areaMax ?? '?'} m²` : null)}${linha('Até', brl(input.valorMax))}${linha('Quartos', input.quartos)}${linha('Mensagem', input.mensagem)}</table>
         <p style="font-size:13px;color:#6b6f76;margin-top:16px">Veja todos em Painel → Interessados.</p>`
      )
    );
  }
  return { ok: true };
}

export type InteresseLead = {
  id: string;
  developmentId: string | null;
  condominio: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  finalidade: 'venda' | 'aluguel';
  areaMin: number | null;
  areaMax: number | null;
  valorMax: number | null;
  quartos: number | null;
  mensagem: string | null;
  status: 'novo' | 'contatado' | 'descartado';
  descadastrado: boolean;
  ultimoAviso: string | null;
  criadoEm: string;
};

export async function listInteresses(): Promise<InteresseLead[]> {
  requireStaff();
  const rows = await query<Record<string, unknown>>('select * from interest_leads order by created_at desc limit 500');
  const n = (v: unknown) => (v == null ? null : Number(v));
  const d = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());
  return rows.map((r) => ({
    id: String(r.id),
    developmentId: (r.development_id as string) ?? null,
    condominio: String(r.condominio),
    nome: String(r.nome),
    email: (r.email as string) ?? null,
    telefone: (r.telefone as string) ?? null,
    finalidade: r.finalidade === 'aluguel' ? 'aluguel' : 'venda',
    areaMin: n(r.area_min),
    areaMax: n(r.area_max),
    valorMax: n(r.valor_max),
    quartos: n(r.quartos),
    mensagem: (r.mensagem as string) ?? null,
    status: (r.status as InteresseLead['status']) ?? 'novo',
    descadastrado: !!r.descadastrado_em,
    ultimoAviso: d(r.ultimo_aviso_em),
    criadoEm: d(r.created_at) ?? ''
  }));
}

export async function updateInteresseStatus(id: string, status: InteresseLead['status']): Promise<void> {
  requireStaff();
  if (!['novo', 'contatado', 'descartado'].includes(status)) throw new Error('Status inválido.');
  await query('update interest_leads set status = $1 where id = $2::uuid', [status, id]);
}

// Quando um imóvel entra num condomínio, avisa por e-mail quem registrou interesse nele
async function avisarInteressados(propertyId: string): Promise<void> {
  if (!emailConfigurado()) return;
  const props = await query<PropertyRow>("select * from properties where id = $1 and is_tipologia = false and visibilidade = 'publico'", [propertyId]);
  const p = props[0];
  if (!p) return;
  const devRows = p.empreendimento_id ? await query<{ name: string }>('select name from developments where id = $1', [p.empreendimento_id]) : [];
  const nomeCondo = devRows[0]?.name ?? p.condominio;
  if (!nomeCondo && !p.empreendimento_id) return;
  const leads = await query<{ id: string; nome: string; email: string; unsubscribe_token: string; valor_max: string | null }>(
    `select id, nome, email, unsubscribe_token, valor_max from interest_leads
      where email is not null and aceita_contato and descadastrado_em is null and finalidade = $1
        and (($2::text is not null and development_id = $2) or ($3::text is not null and ${norm('condominio')} = ${norm('$3::text')}))`,
    [p.finalidade, p.empreendimento_id, nomeCondo ?? null]
  );
  if (!leads.length) return;
  const imovel = mapPropertyRow(p);
  const titulo = imovel.titulo || `${TIPO_UNIDADE_LABEL[imovel.tipoUnidade]} em ${imovel.location}`;
  const link = `${SITE_URL}/imovel/${p.id}`;
  for (const l of leads) {
    const preco = Number(p.price_value);
    if (l.valor_max && preco > Number(l.valor_max) * 1.35) continue; // bem acima do que a pessoa quer investir
    const ok = await enviarEmail(
      l.email,
      `Novo imóvel no ${formatTitulo(nomeCondo ?? '')}`,
      emailLayout(
        `Surgiu um imóvel no ${escapeHtml(formatTitulo(nomeCondo ?? ''))}`,
        `<p style="font-size:15px">Olá, ${escapeHtml(l.nome.split(' ')[0])}! Você pediu para ser avisado(a), e acabou de entrar:</p>
         <p style="font-size:16px"><strong>${escapeHtml(titulo)}</strong><br>${escapeHtml(imovel.price)} · ${escapeHtml(imovel.beds)} · ${escapeHtml(imovel.area)}</p>
         <p><a href="${link}" style="display:inline-block;background:#14161a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Ver o imóvel</a></p>
         <p style="font-size:11px;color:#9aa0a8;margin-top:20px">Não quer mais receber avisos deste condomínio? <a href="${SITE_URL}/api/interesse/cancelar?t=${l.unsubscribe_token}" style="color:#9aa0a8">Cancelar avisos</a></p>`
      )
    );
    if (ok) await query('update interest_leads set ultimo_aviso_em = now() where id = $1::uuid', [l.id]);
  }
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

// ---------------- Mercado (histórico) ----------------
// Tudo que já passou pelo portal: anúncios ativos (públicos e privados) +
// histórico (vendidos e excluídos). Base do preço médio do m² por bairro.
export type MercadoBairro = {
  bairro: string;
  cidade: string;
  ativos: number;
  privados: number;
  vendidos: number;
  excluidos: number;
  m2Anuncios: number | null; // média do m² pedido (venda) — todos os anúncios
  m2Vendidos: number | null; // média do m² dos vendidos (valor de venda, se informado)
};
export type MercadoMes = { mes: string; m2Anuncios: number | null; nAnuncios: number; m2Vendidos: number | null; nVendidos: number };

const BASE_MERCADO = `
  select p.bairro, p.cidade, p.tipo_unidade, p.price_value as preco, p.area, p.created_at as data_anuncio, null::timestamptz as data_fim,
         case when p.visibilidade = 'privado' then 'privado' else 'ativo' end as estado
    from properties p where p.is_tipologia = false and p.finalidade = 'venda'
  union all
  select h.bairro, h.cidade, h.tipo_unidade, coalesce(h.valor_venda, h.price_value), h.area, h.anunciado_em, h.encerrado_em, h.motivo
    from imoveis_historico h where h.finalidade = 'venda'`;

export async function getMercado(tipos?: string[]): Promise<MercadoBairro[]> {
  requireStaff();
  const filtroTipo = tipos?.length ? 'and tipo_unidade = any($1::text[])' : '';
  const rows = await query<{ bairro: string; cidade: string; ativos: string; privados: string; vendidos: string; excluidos: string; m2a: string | null; m2v: string | null }>(
    `with base as (${BASE_MERCADO})
     select mode() within group (order by bairro) as bairro, mode() within group (order by cidade) as cidade,
            count(*) filter (where estado = 'ativo') as ativos,
            count(*) filter (where estado = 'privado') as privados,
            count(*) filter (where estado = 'vendido') as vendidos,
            count(*) filter (where estado = 'excluido') as excluidos,
            avg(preco / area) filter (where preco > 0 and area > 0) as m2a,
            avg(preco / area) filter (where preco > 0 and area > 0 and estado = 'vendido') as m2v
       from base
      where bairro is not null ${filtroTipo}
      group by ${norm('bairro')}, ${norm("coalesce(cidade, '')")}
      order by count(*) desc limit 200`,
    tipos?.length ? [tipos] : []
  );
  const n = (v: string | null) => (v != null ? Math.round(Number(v)) : null);
  return rows.map((r) => ({
    bairro: r.bairro,
    cidade: r.cidade,
    ativos: Number(r.ativos),
    privados: Number(r.privados),
    vendidos: Number(r.vendidos),
    excluidos: Number(r.excluidos),
    m2Anuncios: n(r.m2a),
    m2Vendidos: n(r.m2v)
  }));
}

export async function getMercadoMensal(bairro: string, cidade: string, tipos?: string[]): Promise<MercadoMes[]> {
  requireStaff();
  const params: unknown[] = [bairro, cidade];
  const filtroTipo = tipos?.length ? `and tipo_unidade = any($3::text[])` : '';
  if (tipos?.length) params.push(tipos);
  const rows = await query<{ mes: string; m2a: string | null; na: string; m2v: string | null; nv: string }>(
    `with base as (${BASE_MERCADO}),
     sel as (select * from base where ${norm("coalesce(bairro, '')")} = ${norm('$1::text')} and ${norm("coalesce(cidade, '')")} = ${norm('$2::text')} ${filtroTipo}),
     anuncios as (
       select to_char(date_trunc('month', data_anuncio), 'YYYY-MM') as mes, avg(preco / area) as m2, count(*) as n
         from sel where preco > 0 and area > 0 and data_anuncio is not null group by 1
     ),
     vendas as (
       select to_char(date_trunc('month', data_fim), 'YYYY-MM') as mes, avg(preco / area) as m2, count(*) as n
         from sel where estado = 'vendido' and preco > 0 and area > 0 group by 1
     )
     select coalesce(a.mes, v.mes) as mes, a.m2 as m2a, coalesce(a.n, 0) as na, v.m2 as m2v, coalesce(v.n, 0) as nv
       from anuncios a full join vendas v on v.mes = a.mes
      order by 1`,
    params
  );
  return rows.map((r) => ({
    mes: r.mes,
    m2Anuncios: r.m2a != null ? Math.round(Number(r.m2a)) : null,
    nAnuncios: Number(r.na),
    m2Vendidos: r.m2v != null ? Math.round(Number(r.m2v)) : null,
    nVendidos: Number(r.nv)
  }));
}

export type HistoricoLinha = { propertyId: string; motivo: string; titulo: string | null; tipoUnidade: string; preco: number | null; valorVenda: number | null; area: number | null; bairro: string | null; cidade: string | null; condominio: string | null; encerradoEm: string };

export async function listHistorico(): Promise<HistoricoLinha[]> {
  requireStaff();
  const rows = await query<{ property_id: string; motivo: string; titulo: string | null; tipo_unidade: string; price_value: string | null; valor_venda: string | null; area: string | null; bairro: string | null; cidade: string | null; condominio: string | null; encerrado_em: Date }>(
    'select * from imoveis_historico order by encerrado_em desc limit 300'
  );
  return rows.map((r) => ({
    propertyId: r.property_id,
    motivo: r.motivo,
    titulo: r.titulo,
    tipoUnidade: r.tipo_unidade,
    preco: r.price_value ? Number(r.price_value) : null,
    valorVenda: r.valor_venda ? Number(r.valor_venda) : null,
    area: r.area ? Number(r.area) : null,
    bairro: r.bairro,
    cidade: r.cidade,
    condominio: r.condominio,
    encerradoEm: new Date(r.encerrado_em).toISOString()
  }));
}

// Leitura das notícias para as páginas públicas (servidor).
import { query } from '../db';
import { slugNews, type Noticia } from './base';

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function mapNoticia(r: Row): Noticia {
  return {
    id: String(r.id),
    slug: String(r.slug),
    titulo: String(r.titulo),
    linhaFina: (r.linha_fina as string) ?? null,
    corpo: String(r.corpo ?? ''),
    resumo: arr<string>(r.resumo),
    faq: arr<{ p: string; r: string }>(r.faq),
    capa: (r.capa as string) ?? null,
    capaAlt: (r.capa_alt as string) ?? null,
    capa16x9: (r.capa_16x9 as string) ?? null,
    videoUrl: (r.video_url as string) ?? null,
    topico: String(r.topico ?? 'mercado'),
    tags: arr<string>(r.tags),
    uf: (r.uf as string) ?? null,
    cidade: (r.cidade as string) ?? null,
    bairro: (r.bairro as string) ?? null,
    empreendimentoId: (r.empreendimento_id as string) ?? null,
    autor: String(r.autor ?? 'Leyde Duarte'),
    status: (r.status as Noticia['status']) ?? 'rascunho',
    principal: !!r.principal,
    seoTitulo: (r.seo_titulo as string) ?? null,
    seoDescricao: (r.seo_descricao as string) ?? null,
    fontes: arr<{ nome: string; url?: string }>(r.fontes),
    origem: String(r.origem ?? 'painel'),
    leituras: Number(r.leituras ?? 0),
    focoImoveis: (['geral', 'horizontal', 'vertical', 'comercial'].includes(String(r.foco_imoveis)) ? r.foco_imoveis : 'auto') as Noticia['focoImoveis'],
    publicadoEm: iso(r.publicado_em),
    agendadoPara: iso(r.agendado_para),
    atualizadoEm: iso(r.updated_at) ?? new Date().toISOString()
  };
}

// Publicada = status publicada, ou agendada cuja hora já chegou
const PUBLICADA = `(status = 'publicada' or (status = 'agendada' and agendado_para <= now()))`;
const DATA_PUB = `coalesce(publicado_em, agendado_para, created_at)`;

export type Filtro = { topico?: string; uf?: string; cidade?: string; bairro?: string; q?: string; excluir?: string[]; limite?: number; pagina?: number };

export async function noticiasPublicadas(f: Filtro = {}): Promise<Noticia[]> {
  const conds = [PUBLICADA];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.topico) conds.push(`topico = ${p(f.topico)}`);
  if (f.uf) conds.push(`upper(uf) = upper(${p(f.uf)})`);
  if (f.cidade) conds.push(`lower(cidade) = lower(${p(f.cidade)})`);
  if (f.bairro) conds.push(`lower(bairro) = lower(${p(f.bairro)})`);
  if (f.q?.trim()) {
    const termo = `%${f.q.trim().slice(0, 60)}%`;
    conds.push(`(titulo ilike ${p(termo)} or linha_fina ilike $${params.length} or bairro ilike $${params.length} or cidade ilike $${params.length} or corpo ilike $${params.length})`);
  }
  if (f.excluir?.length) conds.push(`not (id = any(${p(f.excluir)}::text[]))`);
  const limite = Math.min(f.limite ?? 12, 60);
  const offset = Math.max(0, (f.pagina ?? 0) * limite);
  const rows = await query<Row>(
    `select *, ${DATA_PUB} as publicado_em from noticias where ${conds.join(' and ')} order by principal desc, ${DATA_PUB} desc limit ${limite} offset ${offset}`,
    params
  ).catch(() => []);
  return rows.map(mapNoticia);
}

/** Capa: a principal (marcada ou a mais recente) e as demais mais recentes */
export async function noticiasDaCapa(): Promise<Noticia[]> {
  const rows = await query<Row>(
    `select *, ${DATA_PUB} as publicado_em from noticias where ${PUBLICADA}
      order by (principal and ${DATA_PUB} > now() - interval '30 days') desc, ${DATA_PUB} desc limit 40`
  ).catch(() => []);
  return rows.map(mapNoticia);
}

export async function maisLidas(dias = 30, limite = 5): Promise<Noticia[]> {
  const rows = await query<Row>(
    `select *, ${DATA_PUB} as publicado_em from noticias where ${PUBLICADA} and ${DATA_PUB} > now() - ($1::int * interval '1 day')
      order by leituras desc, ${DATA_PUB} desc limit $2`,
    [dias, limite]
  ).catch(() => []);
  return rows.map(mapNoticia);
}

export async function noticiaPorSlug(slug: string, incluirRascunho = false): Promise<Noticia | null> {
  const rows = await query<Row>(
    `select *, ${DATA_PUB} as publicado_em from noticias where slug = $1 ${incluirRascunho ? '' : `and ${PUBLICADA}`} limit 1`,
    [slug]
  ).catch(() => []);
  return rows[0] ? mapNoticia(rows[0]) : null;
}

/** Relacionadas: mesmo bairro/cidade, depois mesmo tópico, depois as mais recentes */
export async function relacionadas(n: Noticia, limite = 4): Promise<Noticia[]> {
  const rows = await query<Row>(
    `select *, ${DATA_PUB} as publicado_em from noticias where ${PUBLICADA} and id <> $1
      order by (case when $2::text is not null and lower(bairro) = lower($2) then 0
                     when $3::text is not null and lower(cidade) = lower($3) then 1
                     when topico = $4 then 2 else 3 end), ${DATA_PUB} desc limit $5`,
    [n.id, n.bairro, n.cidade, n.topico, limite]
  ).catch(() => []);
  return rows.map(mapNoticia);
}

/** Estados e cidades com notícia publicada (a lista cresce sozinha) */
export async function regioesComNoticias(): Promise<{ uf: string; cidade: string | null; n: number }[]> {
  const rows = await query<{ uf: string; cidade: string | null; n: string }>(
    `select upper(uf) as uf, cidade, count(*) as n from noticias where ${PUBLICADA} and uf is not null
      group by rollup (upper(uf), cidade) having upper(uf) is not null order by upper(uf), n desc`
  ).catch(() => []);
  return rows.map((r) => ({ uf: r.uf, cidade: r.cidade, n: Number(r.n) }));
}

export async function cidadePorSlug(uf: string, slugCidade: string): Promise<string | null> {
  const rows = await query<{ cidade: string }>(`select distinct cidade from noticias where upper(uf) = upper($1) and cidade is not null`, [uf]).catch(() => []);
  return rows.find((r) => slugNews(r.cidade) === slugCidade)?.cidade ?? null;
}

export async function contarLeitura(id: string): Promise<void> {
  await query('update noticias set leituras = leituras + 1 where id = $1', [id]).catch(() => {});
}

export async function urlsNoticiasSitemap(): Promise<{ topico: string; slug: string; em: string }[]> {
  const rows = await query<{ topico: string; slug: string; em: Date | string }>(
    `select topico, slug, updated_at as em from noticias where ${PUBLICADA} order by ${DATA_PUB} desc limit 5000`
  ).catch(() => []);
  return rows.map((r) => ({ topico: r.topico, slug: r.slug, em: iso(r.em) ?? new Date().toISOString() }));
}

export type BannerAtivo = { id: string; posicao: string; imagem: string | null; video_url: string | null; link: string | null; titulo: string | null };
export async function bannersAtivos(): Promise<BannerAtivo[]> {
  return query<BannerAtivo>(
    `select id, posicao, imagem, video_url, link, titulo from banners where ativo and (inicio is null or inicio <= current_date) and (fim is null or fim >= current_date) order by random()`
  ).catch(() => []);
}

/** Notícias para as páginas de imóvel/condomínio: do mesmo bairro, depois da cidade, depois as mais recentes */
export async function noticiasParaLugar(bairro?: string | null, cidade?: string | null, limite = 4): Promise<Noticia[]> {
  const rows = await query<Row>(
    `select *, ${DATA_PUB} as publicado_em from noticias where ${PUBLICADA}
      order by (case when $1::text is not null and lower(bairro) = lower($1) then 0
                     when $2::text is not null and lower(cidade) = lower($2) then 1 else 2 end),
               principal desc, ${DATA_PUB} desc limit $3`,
    [bairro ?? null, cidade ?? null, limite]
  ).catch(() => []);
  return rows.map(mapNoticia);
}

/** Condomínios publicados para o link automático no texto (nome → endereço). Só nomes
 *  distintivos: 2+ palavras ou 8+ letras, sem nomes genéricos repetidos na base. */
let cacheCondos: { em: number; lista: { nome: string; url: string }[] } | null = null;
export async function condominiosParaLink(): Promise<{ nome: string; url: string }[]> {
  if (cacheCondos && Date.now() - cacheCondos.em < 10 * 60 * 1000) return cacheCondos.lista;
  const rows = await query<{ name: string; slug: string; bairro: string | null; cidade: string | null; uf: string | null }>(
    `select name, slug, bairro, cidade, uf from developments d
      where status = 'publicado' and slug is not null and length(name) >= 8
        and (select count(*) from developments x where lower(x.name) = lower(d.name) and x.status = 'publicado') = 1`
  ).catch(() => []);
  const s = (t: string) => slugNews(t);
  const lista = rows
    .filter((r) => r.name.trim().includes(' ') || r.name.length >= 10)
    .map((r) => ({ nome: r.name.trim(), url: `/empreendimento/${(r.uf ?? 'go').toLowerCase()}/${s(r.cidade ?? 'goiania')}/${s(r.bairro ?? '')}/${r.slug}` }))
    .sort((a, b) => b.nome.length - a.nome.length); // nomes maiores primeiro ("Jardins Valência" antes de "Valência")
  cacheCondos = { em: Date.now(), lista };
  return lista;
}

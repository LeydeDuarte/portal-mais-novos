// Páginas de região (SEO), em silos com o estado na URL:
//   /imoveis-a-venda/go/goiania, /imoveis-a-venda/go/goiania/setor-bueno,
//   /imoveis-a-venda/go/goiania/setor-bueno/apartamentos … Geradas a partir dos anúncios
// públicos — só existem onde há imóvel ou condomínio de verdade (sem página vazia).
// Módulo só do servidor (não é "use server": nada aqui vira endpoint público).
import { unstable_cache } from 'next/cache';
import { query } from './db';
import { mapPropertyRow, type PropertyRow } from './db-mappers';
import { slugify } from './seo';
import type { TipoUnidade } from './tipologias';
import type { PropertyDetail } from './property-details';

export const CATEGORIAS: Record<string, { nome: string; singular: string; tipos: TipoUnidade[] }> = {
  apartamentos: {
    nome: 'Apartamentos',
    singular: 'apartamento',
    tipos: ['apartamento', 'apartamento_garden', 'apartamento_duplex', 'apartamento_triplex', 'studio', 'flat', 'loft']
  },
  coberturas: { nome: 'Coberturas', singular: 'cobertura', tipos: ['cobertura', 'cobertura_duplex', 'penthouse'] },
  'casas-em-condominio': { nome: 'Casas em condomínio', singular: 'casa em condomínio', tipos: ['casa_condominio'] },
  casas: { nome: 'Casas e sobrados', singular: 'casa', tipos: ['casa', 'sobrado'] },
  terrenos: { nome: 'Terrenos e lotes', singular: 'terreno', tipos: ['terreno_lote'] },
  chacaras: { nome: 'Chácaras e sítios', singular: 'chácara', tipos: ['chacara_sitio_fazenda'] },
  comerciais: { nome: 'Imóveis comerciais', singular: 'imóvel comercial', tipos: ['sala_comercial', 'loja_ponto_comercial', 'galpao', 'predio_comercial'] }
};
export const categoriaDoTipo = (t: string) => Object.entries(CATEGORIAS).find(([, c]) => (c.tipos as string[]).includes(t))?.[0];

const PUBLICO = "p.visibilidade = 'publico' and p.is_tipologia = false and p.vendido_em is null and p.finalidade = 'venda'";

export type Regiao = { uf: string; cidade: string; bairro: string | null; n: number; categorias: Record<string, number>; condominios: number };

const UF_SQL = (col: string) => `coalesce(nullif(upper(trim(${col})), ''), 'GO')`;

/** Todas as cidades/bairros com anúncio (ou condomínio lançamento/novo), com contagens por categoria */
export const listarRegioes = unstable_cache(
  async (): Promise<Regiao[]> => {
    const rows = await query<{ uf: string; cidade: string; bairro: string | null; tipo: string; n: string }>(
      `select ${UF_SQL('p.uf')} as uf, p.cidade, p.bairro, p.tipo_unidade as tipo, count(*) as n from properties p
        where ${PUBLICO} and coalesce(p.cidade, '') <> '' group by 1, 2, 3, 4`
    );
    const condos = await query<{ uf: string; cidade: string; bairro: string | null; n: string }>(
      `select ${UF_SQL('d.uf')} as uf, d.cidade, d.bairro, count(*) as n from developments d
        where d.status = 'publicado' and coalesce(d.cidade, '') <> ''
          and (d.delivery_date > now() - interval '3 years'
               or exists (select 1 from properties x where x.empreendimento_id = d.id and x.visibilidade = 'publico' and not x.is_tipologia))
        group by 1, 2, 3`
    );
    const mapa = new Map<string, Regiao>();
    const pegar = (uf: string, cidade: string, bairro: string | null) => {
      const k = `${uf.toLowerCase()}|${slugify(cidade)}|${bairro ? slugify(bairro) : ''}`;
      if (!mapa.has(k)) mapa.set(k, { uf: uf.toUpperCase(), cidade, bairro, n: 0, categorias: {}, condominios: 0 });
      return mapa.get(k)!;
    };
    for (const r of rows) {
      const cat = categoriaDoTipo(r.tipo);
      for (const reg of [pegar(r.uf, r.cidade, null), ...(r.bairro ? [pegar(r.uf, r.cidade, r.bairro)] : [])]) {
        reg.n += Number(r.n);
        if (cat) reg.categorias[cat] = (reg.categorias[cat] ?? 0) + Number(r.n);
      }
    }
    for (const c of condos) for (const reg of [pegar(c.uf, c.cidade, null), ...(c.bairro ? [pegar(c.uf, c.cidade, c.bairro)] : [])]) reg.condominios += Number(c.n);
    return Array.from(mapa.values()).sort((a, b) => b.n - a.n);
  },
  ['landing-regioes'],
  { revalidate: 600 }
);

export async function acharRegiao(uf: string, cidadeSlug: string, bairroSlug?: string): Promise<Regiao | null> {
  const regs = await listarRegioes();
  return (
    regs.find(
      (r) => r.uf.toLowerCase() === uf.toLowerCase() && slugify(r.cidade) === cidadeSlug && (bairroSlug ? r.bairro && slugify(r.bairro) === bairroSlug : !r.bairro)
    ) ?? null
  );
}

export type Estatisticas = { n: number; min: number | null; max: number | null; m2: number | null; comVideo: number };

export const anunciosDaRegiao = unstable_cache(
  async (cidade: string, bairro: string | null, categoria: string | null, limite = 60): Promise<{ itens: PropertyDetail[]; est: Estatisticas }> => {
    const params: unknown[] = [cidade];
    let cond = `${PUBLICO} and lower(p.cidade) = lower($1)`;
    if (bairro) {
      params.push(bairro);
      cond += ` and lower(coalesce(p.bairro, '')) = lower($${params.length})`;
    }
    if (categoria && CATEGORIAS[categoria]) {
      params.push(CATEGORIAS[categoria].tipos);
      cond += ` and p.tipo_unidade = any($${params.length}::text[])`;
    }
    const [rows, est] = await Promise.all([
      query<PropertyRow>(
        `select p.* from properties p where ${cond}
          order by (case when jsonb_array_length(coalesce(p.photos, '[]'::jsonb)) > 0 then 0 else 1 end), p.created_at desc limit ${Math.min(limite, 120)}`,
        params
      ),
      query<{ n: string; min: string | null; max: string | null; m2: string | null; video: string }>(
        `select count(*) as n, min(nullif(p.price_value, 0)) as min, max(p.price_value) as max,
                avg(p.price_value / nullif(p.area, 0)) filter (where p.price_value > 0 and p.area > 0) as m2,
                count(*) filter (where coalesce(p.video_url, '') <> '') as video
           from properties p where ${cond}`,
        params
      )
    ]);
    const e = est[0];
    return {
      itens: rows.map(mapPropertyRow),
      est: {
        n: Number(e?.n) || 0,
        min: e?.min ? Number(e.min) : null,
        max: e?.max ? Number(e.max) : null,
        m2: e?.m2 ? Math.round(Number(e.m2)) : null,
        comVideo: Number(e?.video) || 0
      }
    };
  },
  ['landing-anuncios'],
  { revalidate: 600 }
);

export type CondoLanding = { id: string; nome: string; capa: string | null; anuncios: number; entrega: string | null; tipo: string };

export const condominiosDaRegiao = unstable_cache(
  async (cidade: string, bairro: string | null): Promise<CondoLanding[]> => {
    const params: unknown[] = [cidade];
    let cond = "d.status = 'publicado' and lower(d.cidade) = lower($1)";
    if (bairro) {
      params.push(bairro);
      cond += ` and lower(coalesce(d.bairro, '')) = lower($${params.length})`;
    }
    const rows = await query<{ id: string; name: string; capa: string | null; mini: string | null; de: string | null; anuncios: string; entrega: Date | null; tipo: string }>(
      `select d.id, d.name, d.photos->>0 as capa, d.capa_mini as mini, d.capa_mini_de as de, d.delivery_date as entrega, d.tipo,
              (select count(*) from properties x where x.empreendimento_id = d.id and x.visibilidade = 'publico' and not x.is_tipologia and x.vendido_em is null) as anuncios
         from developments d where ${cond}
        order by anuncios desc, (d.delivery_date > now() - interval '3 years') desc nulls last, d.name
        limit 80`,
      params
    );
    return rows
      .filter((r) => Number(r.anuncios) > 0 || (r.entrega && new Date(r.entrega).getTime() > Date.now() - 3 * 365.25 * 864e5))
      .map((r) => ({
        id: r.id,
        nome: r.name,
        capa: r.mini && r.de === r.capa ? r.mini : r.capa,
        anuncios: Number(r.anuncios) || 0,
        entrega: r.entrega ? new Date(r.entrega).toISOString().slice(0, 7) : null,
        tipo: r.tipo
      }));
  },
  ['landing-condos'],
  { revalidate: 600 }
);

/** Para o sitemap: anúncios e condomínios públicos com data */
export async function urlsParaSitemap(): Promise<{ imoveis: { id: string; em: Date }[]; condominios: { id: string; em: Date }[] }> {
  const [imoveis, condominios] = await Promise.all([
    query<{ id: string; em: Date }>(
      `select id, coalesce(jetimob_atualizado_em, created_at) as em from properties
        where visibilidade = 'publico' and is_tipologia = false and vendido_em is null`
    ),
    // condomínio sem anúncio e sem ser lançamento/novo fica de fora do feed, mas a página
    // dele existe e é útil no Google (quem pesquisa pelo nome) — entra no sitemap
    query<{ id: string; em: Date }>(`select id, coalesce(jetimob_atualizado_em, created_at) as em from developments where status = 'publicado'`)
  ]);
  return { imoveis, condominios };
}

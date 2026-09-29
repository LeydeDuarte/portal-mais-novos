'use server';

// Painel → Condomínios: lista para a grade (com números), excluir e compartilhar.
import { query } from './db';
import { exigirEquipe, exigirGestor } from './staff-auth';
import { veTudo } from './session';
import { SITE_URL } from './seo';

export type CondoPainel = {
  id: string;
  slug: string | null;
  nome: string;
  status: 'rascunho' | 'publicado';
  tipo: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  entrega: string | null; // AAAA-MM
  capa: string | null;
  fotos: number;
  descricao: number; // tamanho do texto (para escolher o mais completo ao unificar)
  tipologias: string[]; // tipos de imóvel
  anuncios: number;
  visualizacoes: number;
  salvamentos: number;
  compartilhamentos: number;
  m2Medio: number | null;
  aPartirDe: number | null;
  empresas: string[];
  corretorEmail: string | null;
  destaque: boolean;
  destaqueTamanho: 2 | 3;
};

export async function listarCondominiosPainel(): Promise<CondoPainel[]> {
  const eu = await exigirEquipe();
  const rows = await query<Record<string, unknown>>(
    `select d.id, d.slug, d.name, d.status, d.tipo, d.bairro, d.cidade, d.uf, to_char(d.delivery_date, 'YYYY-MM') as entrega,
            coalesce(nullif(d.capa_mini, ''), d.photos->>0) as capa, jsonb_array_length(coalesce(d.photos, '[]'::jsonb)) as fotos,
            length(coalesce(d.description, '')) as descricao, coalesce(d.tipos_unidade, '[]'::jsonb) as tipos, coalesce(d.visualizacoes, 0) as visualizacoes,
            coalesce(d.compartilhamentos, 0) as compartilhamentos, d.corretor_email, d.destaque, d.destaque_tamanho,
            s.anuncios, s.salvamentos, s.m2, s.minimo,
            (select array_agg(coalesce(nullif(e.nome_perfil, ''), nullif(e.nome_fantasia, ''), e.razao_social) order by de.ordem)
               from development_empresas de join empresas e on e.id = de.empresa_id where de.development_id = d.id) as empresas
       from developments d
       left join lateral (
         select count(*) filter (where not p.is_tipologia and p.vendido_em is null) as anuncios,
                (select count(*) from favorites f join properties pf on pf.id = f.property_id where pf.empreendimento_id = d.id) as salvamentos,
                avg(p.price_value / nullif(p.area, 0)) filter (where p.price_value > 0 and p.area > 0 and p.vendido_em is null) as m2,
                min(p.price_value) filter (where p.price_value > 0 and p.vendido_em is null) as minimo
           from properties p where p.empreendimento_id = d.id
       ) s on true
      order by d.delivery_date desc nulls last, d.name
      limit 6000`
  );
  const n = (v: unknown) => (v == null ? null : Math.round(Number(v)));
  return rows
    .map((r) => ({
      id: String(r.id),
      slug: (r.slug as string) ?? null,
      nome: String(r.name),
      status: (r.status === 'rascunho' ? 'rascunho' : 'publicado') as CondoPainel['status'],
      tipo: String(r.tipo ?? 'vertical'),
      bairro: (r.bairro as string) ?? null,
      cidade: (r.cidade as string) ?? null,
      uf: (r.uf as string) ?? null,
      entrega: (r.entrega as string) ?? null,
      capa: (r.capa as string) ?? null,
      fotos: Number(r.fotos) || 0,
      descricao: Number(r.descricao) || 0,
      tipologias: Array.isArray(r.tipos) ? (r.tipos as string[]) : [],
      anuncios: Number(r.anuncios) || 0,
      visualizacoes: Number(r.visualizacoes) || 0,
      salvamentos: Number(r.salvamentos) || 0,
      compartilhamentos: Number(r.compartilhamentos) || 0,
      m2Medio: n(r.m2),
      aPartirDe: n(r.minimo),
      empresas: Array.isArray(r.empresas) ? (r.empresas as string[]) : [],
      corretorEmail: (r.corretor_email as string) ?? null,
      destaque: !!r.destaque,
      destaqueTamanho: (r.destaque_tamanho === 3 ? 3 : 2) as 2 | 3
    }))
    .filter((c) => veTudo(eu.role) || c.status === 'publicado' || c.corretorEmail?.toLowerCase() === eu.email.toLowerCase());
}

/** Link público do condomínio (conta um compartilhamento) */
export async function compartilharCondominio(id: string): Promise<string> {
  await exigirEquipe();
  const r = await query<{ slug: string | null }>('update developments set compartilhamentos = coalesce(compartilhamentos, 0) + 1 where id = $1 returning slug', [id]);
  return `${SITE_URL}/empreendimento/${r[0]?.slug ?? id}`;
}

/** Exclui o condomínio. Anúncios avulsos ligados a ele continuam no ar (só perdem o vínculo). */
export async function excluirCondominio(id: string): Promise<{ ok: boolean; erro?: string }> {
  await exigirGestor();
  await query('update properties set empreendimento_id = null where empreendimento_id = $1 and not is_tipologia', [id]);
  await query('delete from properties where empreendimento_id = $1 and is_tipologia', [id]);
  await query('delete from developments where id = $1', [id]);
  return { ok: true };
}

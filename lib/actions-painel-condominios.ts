'use server';

// Painel → Condomínios: lista para a grade (com números), excluir e compartilhar.
import { linhaCondominio, mensagemComLink } from './compartilhar';
import { urlCondominio } from './urls';
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
  temVideo: boolean;
  aceitaTemporada: boolean;
  /** unidades disponíveis pela tabela de vendas mais recente */
  disponiveis: number | null;
  tabelaReferencia: string | null;
  tabelaAcompanhar: boolean;
  vendido100: boolean;
  obraParalisada: boolean;
  obraParalisadaObs: string | null;
  tabelaMotivo: string | null;
};

export async function listarCondominiosPainel(): Promise<CondoPainel[]> {
  const eu = await exigirEquipe();
  const rows = await query<Record<string, unknown>>(
    `select d.id, d.slug, d.name, d.status, d.tipo, d.bairro, d.cidade, d.uf, to_char(d.delivery_date, 'YYYY-MM') as entrega, d.disponiveis, to_char(d.tabela_referencia, 'YYYY-MM') as tabela_ref, d.tabela_acompanhar, d.tabela_parou_motivo, d.vendido_100, d.obra_paralisada, d.obra_paralisada_obs,
            coalesce(nullif(d.capa_mini, ''), d.photos->>0) as capa, jsonb_array_length(coalesce(d.photos, '[]'::jsonb)) as fotos,
            length(coalesce(d.description, '')) as descricao, coalesce(d.tipos_unidade, '[]'::jsonb) as tipos, coalesce(d.visualizacoes, 0) as visualizacoes,
            coalesce(d.compartilhamentos, 0) as compartilhamentos, d.corretor_email, d.destaque, d.destaque_tamanho, d.video_url, d.aceita_temporada,
            s.anuncios, s.salvamentos, s.m2, s.minimo,
            (select array_agg(coalesce(nullif(e.nome_perfil, ''), nullif(e.nome_fantasia, ''), e.razao_social) order by de.ordem)
               from development_empresas de join empresas e on e.id = de.empresa_id where de.development_id = d.id) as empresas
       from developments d
       left join lateral (
         select count(*) filter (where not p.is_tipologia and p.vendido_em is null) as anuncios,
                ((select count(*) from favorites f join properties pf on pf.id = f.property_id where pf.empreendimento_id = d.id) + (select count(*) from favoritos_condominios fc where fc.development_id = d.id)) as salvamentos,
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
      destaqueTamanho: (r.destaque_tamanho === 3 ? 3 : 2) as 2 | 3,
      temVideo: !!r.video_url,
      aceitaTemporada: !!r.aceita_temporada,
      disponiveis: r.disponiveis != null ? Number(r.disponiveis) : null,
      tabelaReferencia: (r.tabela_ref as string) ?? null,
      tabelaAcompanhar: r.tabela_acompanhar !== false,
      vendido100: !!r.vendido_100,
      obraParalisada: !!r.obra_paralisada,
      obraParalisadaObs: (r.obra_paralisada_obs as string) ?? null,
      tabelaMotivo: (r.tabela_parou_motivo as string) ?? null
    }))
    .filter((c) => veTudo(eu.role) || c.status === 'publicado' || c.corretorEmail?.toLowerCase() === eu.email.toLowerCase());
}

/** Mensagem com o link público do condomínio para o cliente (conta um compartilhamento):
 *  "Marista 262 - Setor Marista - 3 e 4 Quartos - 118 a 252m² - a partir de: R$ 1.430.000" e o link abaixo */
export async function compartilharCondominio(id: string): Promise<string> {
  await exigirEquipe();
  const r = await query<{
    id: string; slug: string | null; name: string; bairro: string | null; cidade: string | null; uf: string | null;
    qmin: number | null; qmax: number | null; amin: number | null; amax: number | null; preco: number | null;
  }>(
    `update developments d set compartilhamentos = coalesce(d.compartilhamentos, 0) + 1 where d.id = $1
     returning d.id, d.slug, d.name, d.bairro, d.cidade, d.uf,
       (select min(q) from (select v::int q from jsonb_array_elements_text(d.quartos_opcoes) v union all select quartos from properties where empreendimento_id = d.id and quartos > 0) x) as qmin,
       (select max(q) from (select v::int q from jsonb_array_elements_text(d.quartos_opcoes) v union all select quartos from properties where empreendimento_id = d.id and quartos > 0) x) as qmax,
       (select min(area) from properties where empreendimento_id = d.id and area > 0) as amin,
       (select max(area) from properties where empreendimento_id = d.id and area > 0) as amax,
       (select min(price_value) from properties where empreendimento_id = d.id and price_value > 0 and vendido_em is null) as preco`,
    [id]
  );
  const c = r[0];
  if (!c) return `${SITE_URL}/empreendimento/${id}`;
  const n = (v: unknown) => (v == null ? null : Number(v));
  return mensagemComLink(
    linhaCondominio({ nome: c.name, bairro: c.bairro, cidade: c.cidade, quartosMin: n(c.qmin), quartosMax: n(c.qmax), areaMin: n(c.amin), areaMax: n(c.amax), aPartirDe: n(c.preco) }),
    `${SITE_URL}${urlCondominio(c)}`
  );
}

/** Exclui o condomínio. Anúncios avulsos ligados a ele continuam no ar (só perdem o vínculo). */
export async function excluirCondominio(id: string): Promise<{ ok: boolean; erro?: string }> {
  await exigirGestor();
  await query('update properties set empreendimento_id = null where empreendimento_id = $1 and not is_tipologia', [id]);
  await query('delete from properties where empreendimento_id = $1 and is_tipologia', [id]);
  await query('delete from developments where id = $1', [id]);
  return { ok: true };
}

/** Três pontinhos → marcar/desmarcar "aceita temporada" no condomínio */
export async function marcarTemporadaCondominio(id: string, aceita: boolean): Promise<void> {
  const eu = await exigirEquipe();
  if (!veTudo(eu.role)) throw new Error('Só o analista ou o administrador marcam a temporada do condomínio.');
  await query('update developments set aceita_temporada = $2 where id = $1', [id, aceita]);
}

/** Obra paralisada (só analista e admin). A observação é interna (não aparece no site). */
export async function marcarObraParalisada(id: string, paralisada: boolean, observacao?: string): Promise<void> {
  const eu = await exigirEquipe();
  if (!veTudo(eu.role)) throw new Error('Só o analista ou o administrador marcam obra paralisada.');
  const obs = String(observacao ?? '').trim().slice(0, 300);
  if (paralisada)
    await query(`update developments set obra_paralisada = true, obra_paralisada_em = now(), obra_paralisada_obs = $2 where id = $1`, [id, obs ? `${obs} (por ${eu.email})` : `por ${eu.email}`]);
  else await query(`update developments set obra_paralisada = false, obra_paralisada_em = null, obra_paralisada_obs = null where id = $1`, [id]);
}

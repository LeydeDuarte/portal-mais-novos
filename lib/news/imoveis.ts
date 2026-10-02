// Imóveis que aparecem dentro do News, em ordem de importância:
//   1. anúncios do condomínio/empreendimento citado na notícia
//   2. bairro citado: destaques do bairro, depois os demais anúncios do bairro
//   3. tipo do assunto (condomínios horizontais, prédios ou comercial): destaques desse
//      tipo espalhados por bairros diferentes, depois os demais desse tipo
//   4. destaques gerais e, por fim, anúncios recentes com foto
// Nunca repete imóvel e respeita o tipo do assunto em todas as etapas em que ele existe.
import { query } from '../db';
import { mapPropertyRow, type PropertyRow } from '../db-mappers';
import { comCorretores } from '../corretores';
import { TIPOS_CASA } from '../tipologias';
import type { FocoImoveis } from './base';

const PUBLICO = "p.visibilidade = 'publico' and not p.is_tipologia and p.vendido_em is null and p.finalidade = 'venda'";
const COMERCIAIS = ['sala_comercial', 'loja_ponto_comercial', 'galpao', 'predio_comercial'];
const COM_FOTO = "jsonb_array_length(coalesce(p.photos, '[]'::jsonb)) > 0";

function condTipo(foco: Exclude<FocoImoveis, 'auto' | 'geral'> | null): string {
  if (foco === 'horizontal') return `p.tipo_unidade = any('{${TIPOS_CASA.join(',')}}'::text[])`;
  if (foco === 'comercial') return `p.tipo_unidade = any('{${COMERCIAIS.join(',')}}'::text[])`;
  if (foco === 'vertical') return `not (p.tipo_unidade = any('{${[...TIPOS_CASA, ...COMERCIAIS].join(',')}}'::text[]))`;
  return 'true';
}

export type ContextoImoveis = {
  empreendimentoId?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  foco?: Exclude<FocoImoveis, 'auto' | 'geral'> | null;
};

export async function imoveisParaNoticia(ctx: ContextoImoveis, limite = 4) {
  const vistos = new Set<string>();
  const out: PropertyRow[] = [];
  const tipo = condTipo(ctx.foco ?? null);
  const etapa = async (where: string, params: unknown[], ordem: string, variado = false) => {
    if (out.length >= limite) return;
    const falta = limite - out.length;
    const excl = Array.from(vistos);
    const base = `select p.* from properties p where ${PUBLICO} and ${where} and not (p.id = any($${params.length + 1}::text[]))`;
    // "variado": um imóvel por bairro, para mostrar várias regiões
    const sql = variado
      ? `select * from (select distinct on (lower(coalesce(x.bairro, x.id))) x.* from (${base}) x order by lower(coalesce(x.bairro, x.id)), random()) y order by random() limit ${falta}`
      : `${base} order by ${ordem} limit ${falta}`;
    const rows = await query<PropertyRow>(sql, [...params, excl]).catch(() => []);
    for (const r of rows) {
      if (vistos.has(r.id)) continue;
      vistos.add(r.id);
      out.push(r);
    }
  };

  // 1. condomínio citado
  if (ctx.empreendimentoId) await etapa('p.empreendimento_id = $1', [ctx.empreendimentoId], `p.destaque desc, (${COM_FOTO}) desc, random()`);
  // 2. bairro citado: destaques do bairro (do tipo, se houver), depois os demais do bairro
  if (ctx.bairro) {
    const b = ['lower(p.bairro) = lower($1)', ctx.cidade ? 'lower(p.cidade) = lower($2)' : 'true'].join(' and ');
    const pb = ctx.cidade ? [ctx.bairro, ctx.cidade] : [ctx.bairro];
    await etapa(`${b} and ${tipo} and p.destaque`, pb, 'random()');
    await etapa(`${b} and ${tipo}`, pb, `(${COM_FOTO}) desc, random()`);
    if (ctx.foco) await etapa(`${b} and p.destaque`, pb, 'random()'); // bairro sem o tipo: outros destaques do bairro
  }
  // 3. tipo do assunto, espalhado por bairros: destaques primeiro, depois sem destaque
  if (ctx.foco) {
    const c = ctx.cidade ? ['lower(p.cidade) = lower($1)'] : [];
    await etapa([tipo, 'p.destaque', ...c].join(' and '), ctx.cidade ? [ctx.cidade] : [], 'random()', true);
    await etapa([tipo, COM_FOTO, ...c].join(' and '), ctx.cidade ? [ctx.cidade] : [], 'random()', true);
    await etapa([tipo, 'p.destaque'].join(' and '), [], 'random()', true); // outras cidades
  }
  // 3b. só a cidade (ex.: cidade de quem está vendo): destaques da cidade, depois os com foto
  if (ctx.cidade && !ctx.bairro && !ctx.foco) {
    await etapa('lower(p.cidade) = lower($1) and p.destaque', [ctx.cidade], 'random()', true);
    await etapa(`lower(p.cidade) = lower($1) and ${COM_FOTO}`, [ctx.cidade], 'random()', true);
  }
  // 4. geral
  await etapa('p.destaque', [], 'random()', true);
  await etapa(COM_FOTO, [], 'p.created_at desc');
  return comCorretores(out, mapPropertyRow);
}

/** Capa e listagens sem assunto definido: destaques de vários bairros */
export const imoveisEmDestaque = (limite = 4, cidade?: string | null) => imoveisParaNoticia({ cidade: cidade ?? null }, limite);

/** Bloco [[imoveis bairro=... cidade=...]] dentro do texto */
export const imoveisDoBairro = (bairro?: string | null, cidade?: string | null, limite = 3, foco: ContextoImoveis['foco'] = null) =>
  imoveisParaNoticia({ bairro, cidade, foco }, limite);

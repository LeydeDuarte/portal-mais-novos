// Proprietários (vendedores) dos imóveis — cadastro único, reaproveitado em vários
// imóveis e nas propostas. Só do servidor; dados nunca vão para páginas públicas.
import { query } from './db';

import { faltandoNoCadastro, pessoasDaProposta, temConjuge, ESTADOS_CIVIS, REGIMES_BENS, type Conjuge, type Proprietario } from './proprietarios-tipos';
export { faltandoNoCadastro, pessoasDaProposta, temConjuge, ESTADOS_CIVIS, REGIMES_BENS };
export type { Conjuge, Proprietario };
export type ProprietarioDoImovel = Proprietario & { principal: boolean };

type Row = {
  id: string;
  tipo: string;
  nome: string;
  documento: string | null;
  whatsapp: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  empresa_id: string | null;
  observacao: string | null;
  rg?: string | null;
  nascimento?: string | Date | null;
  estado_civil?: string | null;
  regime_bens?: string | null;
  profissao?: string | null;
  nacionalidade?: string | null;
  representante?: string | null;
  conjuge?: unknown;
  imoveis?: string | number | null;
  principal?: boolean;
};
export const mapProprietario = (r: Row): Proprietario => ({
  id: r.id,
  tipo: r.tipo === 'pj' ? 'pj' : 'pf',
  nome: r.nome,
  documento: r.documento,
  whatsapp: r.whatsapp,
  email: r.email,
  cep: r.cep,
  endereco: r.endereco,
  bairro: r.bairro,
  cidade: r.cidade,
  uf: r.uf,
  empresaId: r.empresa_id,
  observacao: r.observacao,
  rg: r.rg ?? null,
  nascimento: r.nascimento ? (r.nascimento instanceof Date ? r.nascimento.toISOString() : String(r.nascimento)).slice(0, 10) : null,
  estadoCivil: r.estado_civil ?? null,
  regimeBens: r.regime_bens ?? null,
  profissao: r.profissao ?? null,
  nacionalidade: r.nacionalidade ?? null,
  representante: r.representante ?? null,
  conjuge: r.conjuge && typeof r.conjuge === 'object' && (r.conjuge as Conjuge).nome ? (r.conjuge as Conjuge) : null,
  imoveis: r.imoveis != null ? Number(r.imoveis) : undefined
});

export async function proprietariosDoImovel(propertyIds: string[]): Promise<Map<string, ProprietarioDoImovel[]>> {
  const m = new Map<string, ProprietarioDoImovel[]>();
  if (!propertyIds.length) return m;
  const rows = await query<Row & { property_id: string }>(
    `select pp.property_id, pp.principal, o.* from property_proprietarios pp join proprietarios o on o.id = pp.proprietario_id
      where pp.property_id = any($1::text[]) order by pp.principal desc, pp.ordem, o.nome`,
    [propertyIds]
  ).catch(() => []);
  for (const r of rows) {
    const l = m.get(r.property_id) ?? [];
    l.push({ ...mapProprietario(r), principal: !!r.principal });
    m.set(r.property_id, l);
  }
  return m;
}

/** Substitui a lista de proprietários do imóvel (quem chama já conferiu a permissão) */
export async function gravarProprietariosDoImovel(propertyId: string, itens: { proprietarioId: string; principal: boolean }[]): Promise<void> {
  const vistos = new Set<string>();
  const limpos = itens.filter((i) => /^[0-9a-f-]{36}$/i.test(i.proprietarioId) && !vistos.has(i.proprietarioId) && vistos.add(i.proprietarioId));
  if (limpos.length && !limpos.some((i) => i.principal)) limpos[0].principal = true;
  await query('delete from property_proprietarios where property_id = $1', [propertyId]);
  for (const [ordem, i] of limpos.entries()) {
    await query('insert into property_proprietarios (property_id, proprietario_id, principal, ordem) values ($1, $2::uuid, $3, $4)', [
      propertyId,
      i.proprietarioId,
      !!i.principal,
      ordem
    ]);
  }
}

// ---------------- proposta → cadastro ----------------
type PessoaProposta = {
  nome: string;
  documento?: string;
  rg?: string;
  nascimento?: string;
  estadoCivil?: string;
  profissao?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  representante?: string;
};
const soDig = (v?: string | null, n = 14) => (v ?? '').replace(/\D/g, '').slice(0, n) || null;
const txt = (v?: string | null, n = 200) => (v ?? '').trim().slice(0, n) || null;
/** "Casado(a), Comunhão parcial de bens" → estado civil e regime separados */
function separarEstadoCivil(v?: string | null): { estado: string | null; regime: string | null } {
  const partes = (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const regime = partes.find((p) => /comunh|separa[cç][aã]o total|aquestos/i.test(p)) ?? null;
  const estado = partes.find((p) => p !== regime) ?? null;
  return { estado, regime };
}

/**
 * Depois de salvar uma proposta: o que foi preenchido nos vendedores completa o cadastro
 * dos proprietários (só campos vazios; nunca apaga nem troca o que já estava).
 * - Vendedor com CPF/CNPJ já cadastrado: completa o cadastro dele.
 * - 2º vendedor sem cadastro, quando o 1º é casado/união estável sem cônjuge: vira o cônjuge.
 * - Vendedor com CPF/CNPJ que não existe, numa proposta de anúncio avulso: vira proprietário do imóvel.
 */
export async function completarProprietariosDaProposta(vendedores: PessoaProposta[], propertyId: string | null): Promise<void> {
  const lista = (vendedores ?? []).filter((v) => v?.nome?.trim());
  if (!lista.length) return;
  const avulso = propertyId
    ? (await query<{ ok: boolean }>('select not is_tipologia as ok from properties where id = $1', [propertyId]).catch(() => []))[0]?.ok === true
    : false;
  const donosDoImovel = propertyId ? (await proprietariosDoImovel([propertyId])).get(propertyId) ?? [] : [];
  let casadoSemConjuge: string | null = null;
  const usados = new Set<number>();

  for (const [i, v] of lista.entries()) {
    const doc = soDig(v.documento);
    const { estado, regime } = separarEstadoCivil(v.estadoCivil);
    // acha o cadastro: pelo CPF/CNPJ, ou pelo nome entre os donos do imóvel
    let id: string | null = null;
    if (doc) id = (await query<{ id: string }>('select id from proprietarios where documento = $1 limit 1', [doc]))[0]?.id ?? null;
    if (!id) id = donosDoImovel.find((o) => o.nome.trim().toLowerCase() === v.nome.trim().toLowerCase())?.id ?? null;
    if (id) {
      usados.add(i);
      const r = await query<{ estado_civil: string | null; conjuge: unknown }>(
        `update proprietarios set
           documento = coalesce(documento, $2), rg = coalesce(rg, $3), nascimento = coalesce(nascimento, $4::date),
           estado_civil = coalesce(estado_civil, $5), regime_bens = coalesce(regime_bens, $6), profissao = coalesce(profissao, $7),
           whatsapp = coalesce(whatsapp, $8), email = coalesce(email, $9), cep = coalesce(cep, $10), endereco = coalesce(endereco, $11),
           bairro = coalesce(bairro, $12), cidade = coalesce(cidade, $13), uf = coalesce(uf, $14), representante = coalesce(representante, $15),
           updated_at = now()
         where id = $1::uuid returning estado_civil, conjuge`,
        [id, doc, txt(v.rg, 30), /^\d{4}-\d{2}-\d{2}$/.test(v.nascimento ?? '') ? v.nascimento : null, txt(estado, 40), txt(regime, 60), txt(v.profissao, 80),
          soDig(v.telefone, 13), txt(v.email, 160)?.toLowerCase() ?? null, soDig(v.cep, 8), txt(v.endereco), txt(v.bairro, 100), txt(v.cidade, 100),
          txt(v.uf, 2)?.toUpperCase() ?? null, txt(v.representante)]
      ).catch(() => []);
      if (r[0] && temConjuge(r[0].estado_civil) && !(r[0].conjuge as Conjuge | null)?.nome && !casadoSemConjuge) casadoSemConjuge = id;
    }
  }

  // cônjuge: o próximo vendedor sem cadastro vira o cônjuge do casado
  if (casadoSemConjuge) {
    const i = lista.findIndex((_, k) => !usados.has(k));
    if (i >= 0) {
      const c = lista[i];
      usados.add(i);
      await query('update proprietarios set conjuge = $2::jsonb, updated_at = now() where id = $1::uuid and conjuge is null', [
        casadoSemConjuge,
        JSON.stringify({
          nome: c.nome.trim(),
          documento: soDig(c.documento, 11),
          rg: txt(c.rg, 30),
          nascimento: /^\d{4}-\d{2}-\d{2}$/.test(c.nascimento ?? '') ? c.nascimento : null,
          profissao: txt(c.profissao, 80),
          telefone: soDig(c.telefone, 13),
          email: txt(c.email, 160)?.toLowerCase() ?? null
        })
      ]).catch(() => {});
    }
  }

  // anúncio avulso: vendedor com CPF/CNPJ que ainda não existe vira proprietário do imóvel
  if (avulso && propertyId) {
    for (const [i, v] of lista.entries()) {
      if (usados.has(i)) continue;
      const doc = soDig(v.documento);
      if (!doc || (doc.length !== 11 && doc.length !== 14)) continue;
      const { estado, regime } = separarEstadoCivil(v.estadoCivil);
      const novo = await query<{ id: string }>(
        `insert into proprietarios (tipo, nome, documento, rg, nascimento, estado_civil, regime_bens, profissao, whatsapp, email, cep, endereco, bairro, cidade, uf, representante, criado_por)
         values ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'proposta') returning id`,
        [doc.length > 11 ? 'pj' : 'pf', v.nome.trim().slice(0, 160), doc, txt(v.rg, 30), /^\d{4}-\d{2}-\d{2}$/.test(v.nascimento ?? '') ? v.nascimento : null,
          txt(estado, 40), txt(regime, 60), txt(v.profissao, 80), soDig(v.telefone, 13), txt(v.email, 160)?.toLowerCase() ?? null, soDig(v.cep, 8),
          txt(v.endereco), txt(v.bairro, 100), txt(v.cidade, 100), txt(v.uf, 2)?.toUpperCase() ?? null, txt(v.representante)]
      ).catch(() => []);
      if (novo[0])
        await query(
          `insert into property_proprietarios (property_id, proprietario_id, principal, ordem)
           values ($1, $2::uuid, not exists (select 1 from property_proprietarios where property_id = $1), coalesce((select max(ordem) + 1 from property_proprietarios where property_id = $1), 0))
           on conflict do nothing`,
          [propertyId, novo[0].id]
        ).catch(() => {});
    }
  }
}

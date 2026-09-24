'use server';

// Condomínios duplicados: o cadastro manual recusa um nome que já existe na
// mesma cidade, e o que já estiver duplicado (planilha, Jetimob, PDF…) aparece em
// Painel → Condomínios → Possíveis duplicados, lado a lado, para o admin/analista
// confirmar: JUNTAR (vira um só, os anúncios passam para o que ficou) ou
// "SÃO DIFERENTES" (não pergunta mais).
import { cookies } from 'next/headers';
import { query } from './db';
import { veTudo } from './session';
import { exigirGestor, exigirEquipe, staffAtual } from './staff-auth';
import { chaveNome, chaveBairro } from './planilha-condominios';

const gestor = exigirGestor;

const sa = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export type CondoDup = {
  id: string;
  name: string;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  logradouro: string | null;
  entrega: string | null;
  status: string;
  fotos: number;
  capa: string | null;
  anuncios: number;
  origem: string | null;
  jetimob: boolean;
};
export type GrupoDup = { chave: string; provavel: boolean; itens: CondoDup[] };

type Row = {
  id: string;
  name: string;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  logradouro: string | null;
  delivery_date: Date | string | null;
  status: string;
  fotos: number;
  capa: string | null;
  anuncios: string;
  origem: string | null;
  jetimob_id: string | null;
};

async function carregar(): Promise<{ grupos: GrupoDup[] }> {
  const rows = await query<Row>(
    `select d.id, d.name, d.bairro, d.cidade, d.cep, d.logradouro, d.delivery_date, d.status, d.origem, d.jetimob_id,
        jsonb_array_length(coalesce(d.photos, '[]'::jsonb)) as fotos, d.photos->>0 as capa,
        (select count(*) from properties p where p.empreendimento_id = d.id) as anuncios
       from developments d`
  );
  const distintos = new Set((await query<{ a: string; b: string }>('select a, b from condominios_distintos')).map((r) => `${r.a}|${r.b}`));
  const separados = (a: string, b: string) => distintos.has(a < b ? `${a}|${b}` : `${b}|${a}`);

  const porChave = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${chaveNome(r.name)}|${sa(r.cidade ?? '')}`;
    if (!chaveNome(r.name)) continue;
    porChave.set(k, [...(porChave.get(k) ?? []), r]);
  }
  const grupos: GrupoDup[] = [];
  for (const [chave, lista] of Array.from(porChave.entries())) {
    if (lista.length < 2) continue;
    // tira do grupo quem já foi marcado como diferente de TODOS os outros
    const itens = lista.filter((a) => lista.some((b) => b.id !== a.id && !separados(a.id, b.id)));
    if (itens.length < 2) continue;
    const provavel = itens.some((a) =>
      itens.some(
        (b) =>
          a.id < b.id &&
          !separados(a.id, b.id) &&
          (((a.cep ?? '') !== '' && a.cep === b.cep) || (!!a.bairro && !!b.bairro && chaveBairro(a.bairro) === chaveBairro(b.bairro)) || !a.bairro || !b.bairro)
      )
    );
    grupos.push({
      chave,
      provavel,
      itens: itens.map((r) => ({
        id: r.id,
        name: r.name,
        bairro: r.bairro,
        cidade: r.cidade,
        cep: r.cep,
        logradouro: r.logradouro,
        entrega: r.delivery_date ? new Date(r.delivery_date).toISOString().slice(0, 7) : null,
        status: r.status,
        fotos: Number(r.fotos) || 0,
        capa: r.capa,
        anuncios: Number(r.anuncios) || 0,
        origem: r.origem,
        jetimob: !!r.jetimob_id
      }))
    });
  }
  grupos.sort((a, b) => Number(b.provavel) - Number(a.provavel) || b.itens.length - a.itens.length);
  return { grupos };
}

export async function listarDuplicados(): Promise<{ grupos: GrupoDup[]; total: number; provaveis: number }> {
  await gestor();
  const { grupos } = await carregar();
  return { grupos: grupos.slice(0, 60), total: grupos.length, provaveis: grupos.filter((g) => g.provavel).length };
}

/** Quantos grupos de possíveis duplicados existem (aviso na lista de condomínios) */
export async function contarDuplicados(): Promise<number> {
  const s = await staffAtual();
  if (!s || !veTudo(s.role)) return 0;
  const { grupos } = await carregar();
  return grupos.length;
}

export async function marcarDiferentes(ids: string[]): Promise<void> {
  const s = await gestor();
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
      await query('insert into condominios_distintos (a, b, por) values ($1, $2, $3) on conflict do nothing', [a, b, s.email]);
    }
}

/** Junta os condomínios `outros` no `principal`: anúncios, tipologias, interessados e
 *  links passam para ele; o que estiver vazio nele é completado com os dados dos outros. */
export async function juntarCondominios(principal: string, outros: string[]): Promise<{ ok: boolean; erro?: string }> {
  const s = await gestor();
  const lista = outros.filter((o) => o && o !== principal);
  if (!lista.length) return { ok: false, erro: 'Escolha pelo menos um condomínio para juntar.' };
  for (const o of lista) {
    // o código da Jetimob é único: solta do que vai sumir antes de passar para o principal
    const jt = await query<{ jetimob_id: string | null }>('select jetimob_id from developments where id = $1', [o]);
    await query('update developments set jetimob_id = null where id = $1', [o]);
    await query('update developments set jetimob_id = coalesce(jetimob_id, $2::bigint) where id = $1', [principal, jt[0]?.jetimob_id ?? null]);
    await query(
      `update developments p set
          cep = coalesce(nullif(p.cep, ''), o.cep), logradouro = coalesce(nullif(p.logradouro, ''), o.logradouro),
          bairro = coalesce(nullif(p.bairro, ''), o.bairro), cidade = coalesce(nullif(p.cidade, ''), o.cidade), uf = coalesce(nullif(p.uf, ''), o.uf),
          location = case when coalesce(p.location, '') = '' then o.location else p.location end,
          delivery_date = coalesce(p.delivery_date, o.delivery_date),
          description = case when length(coalesce(p.description, '')) < length(coalesce(o.description, '')) and length(coalesce(p.description, '')) < 80 then o.description else p.description end,
          amenities = case when jsonb_array_length(coalesce(p.amenities, '[]'::jsonb)) = 0 then o.amenities else p.amenities end,
          photos = case when jsonb_array_length(coalesce(p.photos, '[]'::jsonb)) = 0 then o.photos else p.photos end,
          tipos_unidade = case when jsonb_array_length(coalesce(p.tipos_unidade, '[]'::jsonb)) = 0 then o.tipos_unidade else p.tipos_unidade end,
          quartos_opcoes = case when jsonb_array_length(coalesce(p.quartos_opcoes, '[]'::jsonb)) = 0 then o.quartos_opcoes else p.quartos_opcoes end,
          video_url = coalesce(nullif(p.video_url, ''), o.video_url),
          lat = coalesce(p.lat, o.lat), lng = coalesce(p.lng, o.lng),
          status = case when p.status = 'publicado' or o.status = 'publicado' then 'publicado' else p.status end
        from developments o where p.id = $1 and o.id = $2`,
      [principal, o]
    );
    await query('update properties set empreendimento_id = $1 where empreendimento_id = $2', [principal, o]);
    await query('update interest_leads set development_id = $1 where development_id = $2', [principal, o]).catch(() => {});
    await query('update imoveis_historico set empreendimento_id = $1 where empreendimento_id = $2', [principal, o]).catch(() => {});
    await query('insert into developments_mesclados (old_id, new_id, por) values ($1, $2, $3) on conflict (old_id) do update set new_id = $2', [o, principal, s.email]);
    await query('update developments_mesclados set new_id = $1 where new_id = $2', [principal, o]);
    await query('delete from developments where id = $1', [o]);
  }
  return { ok: true };
}

/** Endereço antigo de um condomínio que foi juntado a outro */
export async function destinoDoMesclado(id: string): Promise<string | null> {
  const r = await query<{ new_id: string }>('select new_id from developments_mesclados where old_id = $1', [id]);
  return r[0]?.new_id ?? null;
}

/** Cadastro manual: já existe um condomínio com esse nome na mesma cidade? */
export async function condominioExistente(nome: string, cidade?: string | null, ignorarId?: string): Promise<{ id: string; name: string; bairro: string | null } | null> {
  await exigirEquipe();
  const k = chaveNome(nome);
  if (!k) return null;
  const rows = await query<{ id: string; name: string; bairro: string | null; cidade: string | null }>('select id, name, bairro, cidade from developments');
  const c = sa(cidade ?? '');
  const achado = rows.find((r) => r.id !== ignorarId && chaveNome(r.name) === k && (!c || !r.cidade || sa(r.cidade) === c));
  return achado ? { id: achado.id, name: achado.name, bairro: achado.bairro } : null;
}

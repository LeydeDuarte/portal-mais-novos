'use server';

// Ligar anúncios a um condomínio em lote: pelo Painel → Imóveis (seleciona vários e
// escolhe o condomínio) ou pela edição do condomínio (sugestões automáticas).
// Ao ligar: o anúncio passa a aparecer no condomínio (página, feed, mapa e avisos),
// e os campos de endereço VAZIOS são completados com os do condomínio.
import { query } from './db';
import { exigirEquipe } from './staff-auth';
import { veTudo } from './session';
import { gerarAvisos } from './avisos';

const DE = 'áàâãäéèêëíìîïóòôõöúùûüç';
const PARA = 'aaaaaeeeeiiiiooooouuuuc';
const norm = (sql: string) => `translate(lower(trim(${sql})), '${DE}', '${PARA}')`;

export type AnuncioParaVincular = {
  id: string;
  titulo: string;
  condominio: string | null;
  bairro: string | null;
  preco: number | null;
  detalhes: string;
  codigo: string | null;
  motivo?: string;
  vinculado: boolean;
};

type Linha = {
  id: string; titulo: string | null; condominio: string | null; bairro: string | null; price_value: string | null; tipo_unidade: string | null;
  quartos: number | null; area: string | null; jetimob_codigo: string | null; empreendimento_id: string | null; motivo?: string | null; corretor_email: string | null;
};

function mapear(r: Linha, devId?: string): AnuncioParaVincular {
  const det = [r.tipo_unidade?.replace(/_/g, ' '), r.quartos ? `${r.quartos} qtos` : '', r.area ? `${Math.round(Number(r.area))} m²` : ''].filter(Boolean).join(' · ');
  return {
    id: r.id,
    titulo: r.titulo || r.condominio || 'Imóvel',
    condominio: r.condominio,
    bairro: r.bairro,
    preco: r.price_value == null ? null : Number(r.price_value),
    detalhes: det,
    codigo: r.jetimob_codigo,
    motivo: r.motivo ?? undefined,
    vinculado: !!devId && r.empreendimento_id === devId
  };
}

async function podeEditarTodos(ids: string[]) {
  const staff = await exigirEquipe();
  if (veTudo(staff.role)) return staff;
  const donos = await query<{ n: string }>(
    `select count(*) as n from properties where id = any($1::text[]) and lower(coalesce(corretor_email, '')) <> lower($2)`,
    [ids, staff.email]
  );
  if (Number(donos[0]?.n) > 0) throw new Error('Você só pode alterar os anúncios que cadastrou.');
  return staff;
}

/** Liga os anúncios ao condomínio e completa o endereço vazio com o do condomínio */
export async function vincularAnuncios(ids: string[], developmentId: string): Promise<{ ok: number; condominio: string }> {
  const lista = Array.from(new Set((ids ?? []).map(String))).filter((x) => /^[\w-]{1,80}$/.test(x)).slice(0, 300);
  if (!lista.length) return { ok: 0, condominio: '' };
  await podeEditarTodos(lista);
  const d = (await query<{ name: string }>('select name from developments where id = $1', [developmentId]))[0];
  if (!d) throw new Error('Condomínio não encontrado.');
  const r = await query<{ id: string }>(
    `update properties p set
        empreendimento_id = d.id,
        condominio = d.name,
        cep = coalesce(nullif(p.cep, ''), d.cep),
        logradouro = coalesce(nullif(p.logradouro, ''), d.logradouro),
        bairro = coalesce(nullif(p.bairro, ''), d.bairro),
        cidade = coalesce(nullif(p.cidade, ''), d.cidade),
        uf = coalesce(nullif(p.uf, ''), d.uf)
       from developments d
      where d.id = $2 and p.id = any($1::text[]) and not p.is_tipologia
      returning p.id`,
    [lista, developmentId]
  );
  for (const x of r) await gerarAvisos(x.id, { email: false }).catch(() => 0);
  return { ok: r.length, condominio: d.name };
}

/** Desliga do condomínio (o nome digitado do condomínio é mantido) */
export async function desvincularAnuncios(ids: string[]): Promise<number> {
  const lista = Array.from(new Set((ids ?? []).map(String))).filter((x) => /^[\w-]{1,80}$/.test(x)).slice(0, 300);
  if (!lista.length) return 0;
  await podeEditarTodos(lista);
  const r = await query<{ id: string }>(`update properties set empreendimento_id = null where id = any($1::text[]) and not is_tipologia returning id`, [lista]);
  return r.length;
}

/**
 * Na edição do condomínio: os anúncios já ligados e as SUGESTÕES de anúncios
 * soltos que provavelmente são dele (mesmo nome digitado, mesmo CEP ou até 150 m).
 */
export async function anunciosDoCondominio(developmentId: string): Promise<{ vinculados: AnuncioParaVincular[]; sugestoes: AnuncioParaVincular[] }> {
  await exigirEquipe();
  const d = (await query<{ id: string; name: string; cep: string | null; lat: number | null; lng: number | null; cidade: string | null }>(
    'select id, name, cep, lat, lng, cidade from developments where id = $1',
    [developmentId]
  ))[0];
  if (!d) return { vinculados: [], sugestoes: [] };
  const campos = `p.id, p.titulo, p.condominio, p.bairro, p.price_value, p.tipo_unidade, p.quartos, p.area, p.jetimob_codigo, p.empreendimento_id, p.corretor_email`;
  const vinculados = await query<Linha>(
    `select ${campos} from properties p where p.empreendimento_id = $1 and not p.is_tipologia and p.vendido_em is null order by p.created_at desc limit 200`,
    [developmentId]
  );
  const semPalavras = (sql: string) => `regexp_replace(${norm(sql)}, '^(edificio|residencial|condominio|ed\\.?|res\\.?)\\s+', '')`;
  const cep = (d.cep ?? '').replace(/\D/g, '');
  const sugestoes = await query<Linha>(
    `select ${campos},
            case when ${semPalavras('p.condominio')} = ${semPalavras('$2::text')} then 'mesmo nome'
                 when $3::text <> '' and regexp_replace(coalesce(p.cep, ''), '\\D', '', 'g') = $3 then 'mesmo CEP'
                 else 'a menos de 150 m' end as motivo
       from properties p
      where not p.is_tipologia and p.vendido_em is null and p.empreendimento_id is null and $1::text is not null
        and (${norm('coalesce(p.cidade, $6::text)')} = ${norm('coalesce($6::text, p.cidade)')})
        and (
          (coalesce(p.condominio, '') <> '' and ${semPalavras('p.condominio')} = ${semPalavras('$2::text')})
          or ($3::text <> '' and regexp_replace(coalesce(p.cep, ''), '\\D', '', 'g') = $3)
          or ($4::float8 is not null and p.lat is not null
              and (6371000 * 2 * asin(sqrt(power(sin(radians(p.lat - $4) / 2), 2) + cos(radians($4)) * cos(radians(p.lat)) * power(sin(radians(p.lng - $5) / 2), 2)))) <= 150)
        )
      order by p.created_at desc
      limit 60`,
    [developmentId, d.name, cep.length === 8 ? cep : '', d.lat, d.lng, d.cidade]
  );
  return { vinculados: vinculados.map((r) => mapear(r, developmentId)), sugestoes: sugestoes.map((r) => mapear(r, developmentId)) };
}

/** Busca livre (título, condomínio digitado, bairro ou código) para ligar ao condomínio */
export async function buscarAnunciosParaVincular(texto: string, developmentId: string): Promise<AnuncioParaVincular[]> {
  await exigirEquipe();
  const t = String(texto ?? '').trim().slice(0, 80);
  if (t.length < 2) return [];
  const rows = await query<Linha>(
    `select p.id, p.titulo, p.condominio, p.bairro, p.price_value, p.tipo_unidade, p.quartos, p.area, p.jetimob_codigo, p.empreendimento_id, p.corretor_email
       from properties p
      where not p.is_tipologia and p.vendido_em is null
        and ${norm("concat_ws(' ', p.titulo, p.condominio, p.bairro, p.jetimob_codigo, p.id)")} like '%' || ${norm('$1::text')} || '%'
      order by (p.empreendimento_id = $2) asc nulls first, p.created_at desc
      limit 40`,
    [t, developmentId]
  );
  return rows.map((r) => mapear(r, developmentId));
}

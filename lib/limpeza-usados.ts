// Condomínios usados e antigos (entregues há mais de 15 anos): ficam só a foto da fachada
// (a capa) e as plantas. As demais fotos saem do condomínio e das tipologias e são apagadas
// do armazenamento (se nenhum outro lugar usar o mesmo arquivo). Anúncios avulsos não mudam.
import { query } from './db';
import { apagarDoR2 } from './r2';
import { miniaturaDe } from './miniaturas';
import { MESES } from './classification';

export const SQL_USADO = `d.delivery_date is not null and d.delivery_date < date_trunc('month', now()) - interval '${MESES.seminovo} months'`;

export async function ehUsadoOuAntigo(devId: string): Promise<boolean> {
  const r = await query<{ ok: boolean }>(`select (${SQL_USADO}) as ok from developments d where d.id = $1`, [devId]);
  return !!r[0]?.ok;
}

async function usadaEmOutroLugar(url: string, devId: string): Promise<boolean> {
  const like = `%${url}%`;
  const r = await query<{ n: string }>(
    `select (select count(*) from developments where id <> $2 and photos::text like $1)
          + (select count(*) from properties where (photos::text like $1 or plantas::text like $1 or coalesce(photos_internas, '[]'::jsonb)::text like $1)
               and not (is_tipologia and empreendimento_id = $2))
          + (select count(*) from noticias where capa = $3 or corpo like $1) as n`,
    [like, devId, url]
  );
  return Number(r[0]?.n) > 0;
}

/** Deixa só a fachada em UM condomínio usado/antigo. Devolve quantas fotos saíram. */
export async function limparUmCondominio(devId: string): Promise<number> {
  const d = await query<{ photos: string[] | null }>(`select photos from developments d where d.id = $1 and ${SQL_USADO}`, [devId]);
  const fotos = d[0]?.photos ?? [];
  if (fotos.length <= 1) return 0;
  // a melhor fachada reconhecida pela importação; se não houver, a capa atual
  const fach = await query<{ url: string }>(
    `select url from imagens_importadas where development_id = $1 and situacao = 'foto' and categoria = 'fachada' and url = any($2::text[])
      order by qualidade desc limit 1`,
    [devId, fotos]
  );
  const fica = fach[0]?.url ?? fotos[0];
  const saem = fotos.filter((u) => u !== fica);
  await query(`update developments set photos = $2::jsonb where id = $1`, [devId, JSON.stringify([fica])]);
  await query(
    `update properties set photos = $2::jsonb where is_tipologia and empreendimento_id = $1 and jsonb_array_length(coalesce(photos, '[]'::jsonb)) > 0`,
    [devId, JSON.stringify([fica])]
  );
  await query(`update imagens_importadas set situacao = 'removida_usado' where development_id = $1 and url = any($2::text[])`, [devId, saem]);
  for (const u of saem) if (!(await usadaEmOutroLugar(u, devId))) await apagarDoR2(u).catch(() => false);
  await miniaturaDe('developments', devId).catch(() => {});
  return saem.length;
}

/** Varredura (tarefa diária): todos os usados/antigos com mais de uma foto */
export async function limparFotosUsados(limite = 100): Promise<{ condominios: number; fotos: number }> {
  const r = await query<{ id: string }>(
    `select d.id from developments d where ${SQL_USADO} and jsonb_array_length(coalesce(d.photos, '[]'::jsonb)) > 1 limit $1`,
    [limite]
  );
  let fotos = 0;
  for (const x of r) fotos += await limparUmCondominio(x.id).catch(() => 0);
  return { condominios: r.length, fotos };
}

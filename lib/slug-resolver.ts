// Descobre o registro pelo endereço: aceita o slug novo ou o código antigo (id).
// Módulo só do servidor (não vira endpoint).
import { query } from './db';

export type Resolvido = { id: string; slug: string | null; pediuPeloId: boolean };

export async function resolverImovel(param: string): Promise<Resolvido | null> {
  const p = decodeURIComponent(param).slice(0, 200);
  const r = await query<{ id: string; slug: string | null }>('select id, slug from properties where slug = $1 or id = $1 order by (slug = $1) desc limit 1', [p]).catch(() => []);
  return r[0] ? { id: r[0].id, slug: r[0].slug, pediuPeloId: r[0].slug !== p } : null;
}

export async function resolverCondominio(param: string): Promise<Resolvido | null> {
  const p = decodeURIComponent(param).slice(0, 200);
  const r = await query<{ id: string; slug: string | null }>('select id, slug from developments where slug = $1 or id = $1 order by (slug = $1) desc limit 1', [p]).catch(() => []);
  return r[0] ? { id: r[0].id, slug: r[0].slug, pediuPeloId: r[0].slug !== p } : null;
}

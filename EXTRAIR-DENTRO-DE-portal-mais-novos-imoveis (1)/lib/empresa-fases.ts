// Empreendimentos de uma incorporadora por cidade e fase (breve lançamento, lançamento,
// obras e prontos). Fase calculada pela data de entrega, igual ao resto do site.
import { query } from './db';
import { getStatusBucket } from './classification';

export type FasesCidade = { cidade: string; uf: string; breve: number; lancamento: number; obras: number; prontos: number; total: number };

export async function fasesDaEmpresa(ids: string[]): Promise<FasesCidade[]> {
  const rows = await query<{ cidade: string | null; uf: string | null; entrega: Date | string | null }>(
    `select d.cidade, d.uf, d.delivery_date entrega from developments d
       join development_empresas de on de.development_id = d.id
      where de.empresa_id = any($1::uuid[]) and d.status = 'publicado'
      group by d.id, d.cidade, d.uf, d.delivery_date`,
    [ids]
  ).catch(() => []);
  const mapa = new Map<string, FasesCidade>();
  for (const r of rows) {
    const cidade = r.cidade || 'Outras cidades';
    const k = `${cidade}|${r.uf ?? ''}`;
    const it = mapa.get(k) ?? { cidade, uf: (r.uf ?? 'GO').toUpperCase(), breve: 0, lancamento: 0, obras: 0, prontos: 0, total: 0 };
    const b = r.entrega ? getStatusBucket((r.entrega instanceof Date ? r.entrega.toISOString() : String(r.entrega)).slice(0, 10)) : 'antigo';
    if (b === 'breve_lancamento') it.breve++;
    else if (b === 'lancamento') it.lancamento++;
    else if (b === 'obras') it.obras++;
    else it.prontos++;
    it.total++;
    mapa.set(k, it);
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

/** "2 em lançamento, 4 em obras e 25 prontos" (só o que existe) */
export function frasesFases(f: FasesCidade): string {
  const p: string[] = [];
  if (f.breve) p.push(`${f.breve} em breve lançamento`);
  if (f.lancamento) p.push(`${f.lancamento} em lançamento`);
  if (f.obras) p.push(`${f.obras} em obras`);
  if (f.prontos) p.push(`${f.prontos} ${f.prontos === 1 ? 'pronto' : 'prontos'}`);
  return p.length > 1 ? `${p.slice(0, -1).join(', ')} e ${p[p.length - 1]}` : p[0] ?? '';
}

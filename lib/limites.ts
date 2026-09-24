// Limite de tentativas (login, formulários públicos) — contra robôs e força bruta.
// Guarda cada tentativa em `limites_uso` e conta as da janela de tempo.
import { headers } from 'next/headers';
import { query } from './db';

export function ipDoVisitante(): string {
  const h = headers();
  return (h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || 'sem-ip').trim().slice(0, 64);
}

/** true = ainda dentro do limite (pode seguir) */
export async function dentroDoLimite(chave: string, maximo: number, janelaMin: number): Promise<boolean> {
  const r = await query<{ n: string }>(`select count(*) as n from limites_uso where chave = $1 and em > now() - make_interval(mins => $2::int)`, [
    chave.slice(0, 200),
    janelaMin
  ]).catch(() => [{ n: '0' }]);
  return Number(r[0]?.n) < maximo;
}

export async function registrarUso(chave: string): Promise<void> {
  await query('insert into limites_uso (chave) values ($1)', [chave.slice(0, 200)]).catch(() => {});
  if (Math.random() < 0.02) await query("delete from limites_uso where em < now() - interval '2 days'").catch(() => {});
}

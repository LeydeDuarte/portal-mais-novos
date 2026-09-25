// Checagem da sessão da EQUIPE no servidor (usada por todas as ações do painel).
// Além da assinatura do cookie (lib/session.ts), confere no banco a cada requisição:
// - a pessoa ainda existe na equipe (removida = sai na hora);
// - o papel não mudou (trocou de papel = precisa entrar de novo);
// - a sessão não foi derrubada ("sessoes_desde", ex.: troca de senha).
import { cache } from 'react';
import { cookies } from 'next/headers';
import { query } from './db';
import { verifySession, veTudo, type StaffSessionPayload } from './session';

export const STAFF_COOKIE = 'mn_staff';

export const staffAtual = cache(async (): Promise<StaffSessionPayload | null> => {
  const s = verifySession(cookies().get(STAFF_COOKIE)?.value);
  if (!s) return null;
  const r = await query<{ role: string; sessoes_desde: Date | string | null }>(
    'select role, sessoes_desde from staff_users where lower(email) = lower($1)',
    [s.email]
  ).catch(() => null);
  const u = r?.[0];
  if (!u || u.role !== s.role) return null;
  if (u.sessoes_desde && (s.iat ?? 0) * 1000 < new Date(u.sessoes_desde).getTime()) return null;
  return s;
});

const SESSAO_EXPIRADA = 'Sessão da equipe expirada. Faça login novamente no painel.';

export async function exigirEquipe(): Promise<StaffSessionPayload> {
  const s = await staffAtual();
  if (!s) throw new Error(SESSAO_EXPIRADA);
  return s;
}

/** Admin ou analista (veem e mexem em tudo) */
export async function exigirGestor(): Promise<StaffSessionPayload> {
  const s = await exigirEquipe();
  if (!veTudo(s.role)) throw new Error('Só o administrador ou analista pode fazer isso.');
  return s;
}

export async function exigirAdmin(): Promise<StaffSessionPayload> {
  const s = await exigirEquipe();
  if (s.role !== 'admin') throw new Error('Só o administrador pode fazer isso.');
  return s;
}

import crypto from 'crypto';

// Assina os cookies com HMAC — ninguém consegue editar o cookie no navegador
// para virar "admin". A chave vem SÓ da variável SESSION_SECRET (sem chave
// reserva: se faltar, nada de sessão é aceito nem emitido).
function segredo(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET ausente. Configure na Vercel.');
  return s;
}
const hmac = (dominio: string, base: string) => crypto.createHmac('sha256', segredo()).update(`${dominio}:${base}`).digest('base64url');
const igual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const PAPEIS = ['admin', 'analista', 'corretor'];
const VALIDADE_EQUIPE_S = 60 * 60 * 24 * 7; // 7 dias

import type { StaffRole } from './papeis';
export { veTudo, ROLE_LABEL, type StaffRole } from './papeis';
export type StaffSessionPayload = { email: string; name: string; role: StaffRole; iat?: number; exp?: number };

// Cookie da EQUIPE: assinatura própria ("equipe:") — um cookie de cliente nunca
// vale como cookie de equipe — e validade de 7 dias.
export function signSession(payload: StaffSessionPayload): string {
  const agora = Math.floor(Date.now() / 1000);
  const base = Buffer.from(JSON.stringify({ ...payload, iat: agora, exp: agora + VALIDADE_EQUIPE_S })).toString('base64url');
  return `${base}.${hmac('equipe', base)}`;
}

export function verifySession(token: string | undefined): StaffSessionPayload | null {
  if (!token || token.length > 2000) return null;
  const [base, sig] = token.split('.');
  if (!base || !sig) return null;
  try {
    if (!igual(sig, hmac('equipe', base))) return null;
    const p = JSON.parse(Buffer.from(base, 'base64url').toString('utf8')) as StaffSessionPayload;
    if (!p || typeof p.email !== 'string' || !PAPEIS.includes(p.role)) return null;
    if (!p.exp || p.exp * 1000 < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

// Assinatura genérica (cookie do cliente logado com Google) — domínio "geral",
// separado do da equipe.
export function assinar(payload: unknown): string {
  const base = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${base}.${hmac('geral', base)}`;
}

export function verificarAssinado<T>(token: string | undefined): T | null {
  if (!token || token.length > 4000) return null;
  const [base, sig] = token.split('.');
  if (!base || !sig) return null;
  try {
    if (!igual(sig, hmac('geral', base))) return null;
    return JSON.parse(Buffer.from(base, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

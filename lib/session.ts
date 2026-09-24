import crypto from 'crypto';

// Assina o cookie de sessão da equipe com HMAC — evita que alguém edite o
// cookie no navegador pra virar "admin" sozinho. Ainda é uma solução
// simples (MVP); pra produção de verdade, trocar por NextAuth/iron-session
// como já fica registrado no documento de arquitetura.
const SECRET = process.env.SESSION_SECRET || process.env.DATABASE_URL || 'dev-secret-fallback';

import type { StaffRole } from './papeis';
export { veTudo, ROLE_LABEL, type StaffRole } from './papeis';
export type StaffSessionPayload = { email: string; name: string; role: StaffRole };

export function signSession(payload: StaffSessionPayload): string {
  const base = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(base).digest('base64url');
  return `${base}.${sig}`;
}

export function verifySession(token: string | undefined): StaffSessionPayload | null {
  if (!token) return null;
  const [base, sig] = token.split('.');
  if (!base || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(base).digest('base64url');
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(base, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// Assinatura genérica (cookie do cliente logado com Google, links privados)
export function assinar(payload: unknown): string {
  const base = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(base).digest('base64url');
  return `${base}.${sig}`;
}

export function verificarAssinado<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [base, sig] = token.split('.');
  if (!base || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(base).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(base, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** Chave do link privado de um anúncio oculto (não muda enquanto o SESSION_SECRET não mudar) */
export function chaveLinkPrivado(propertyId: string): string {
  return crypto.createHmac('sha256', SECRET).update(`privado:${propertyId}`).digest('base64url').slice(0, 16);
}

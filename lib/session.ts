import crypto from 'crypto';

// Assina o cookie de sessão da equipe com HMAC — evita que alguém edite o
// cookie no navegador pra virar "admin" sozinho. Ainda é uma solução
// simples (MVP); pra produção de verdade, trocar por NextAuth/iron-session
// como já fica registrado no documento de arquitetura.
const SECRET = process.env.SESSION_SECRET || process.env.DATABASE_URL || 'dev-secret-fallback';

export type StaffSessionPayload = { email: string; name: string; role: 'admin' | 'corretor' };

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

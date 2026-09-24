'use server';

import { cookies } from 'next/headers';
import { query } from './db';
import { assinar, verificarAssinado, verifySession } from './session';

// Login de CLIENTE com Google (Google Identity Services).
// O navegador recebe um "credential" (JWT) do Google; aqui ele é conferido no
// próprio Google (tokeninfo) — confere se foi emitido para o NOSSO Client ID —
// e a pessoa é gravada na tabela `clientes` (um registro por e-mail, sem repetir).
// Só entra quem aceitou os Termos de uso; o aceite de marketing é opcional.

export type Cliente = { email: string; nome: string; foto?: string };

const CLIENTE_COOKIE = 'mn_cliente';
const VISITOR_COOKIE = 'mn_visitor';

export async function getCliente(): Promise<Cliente | null> {
  return verificarAssinado<Cliente>(cookies().get(CLIENTE_COOKIE)?.value);
}

export async function loginComGoogle(
  credential: string,
  aceitouTermos: boolean,
  aceitaMarketing: boolean
): Promise<{ ok: true; cliente: Cliente } | { ok: false; erro: string }> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return { ok: false, erro: 'Login com Google ainda não configurado.' };
  if (!aceitouTermos) return { ok: false, erro: 'Para entrar, é preciso aceitar os Termos de uso.' };
  if (typeof credential !== 'string' || credential.length > 5000) return { ok: false, erro: 'Login inválido.' };

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { cache: 'no-store' });
  if (!res.ok) return { ok: false, erro: 'Não foi possível confirmar o login com o Google.' };
  const t = (await res.json()) as { aud?: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string; sub?: string; exp?: string };
  if (t.aud !== clientId || !t.email || String(t.email_verified) !== 'true' || !t.sub || Number(t.exp) * 1000 < Date.now()) {
    return { ok: false, erro: 'Login do Google não confirmado.' };
  }
  const email = t.email.toLowerCase();
  const nome = (t.name ?? email.split('@')[0]).slice(0, 120);

  await query(
    `insert into clientes (email, nome, foto, google_sub, aceitou_termos_em, aceita_marketing)
     values ($1, $2, $3, $4, now(), $5)
     on conflict (email) do update set
       nome = excluded.nome, foto = excluded.foto, google_sub = excluded.google_sub,
       aceitou_termos_em = coalesce(clientes.aceitou_termos_em, now()),
       aceita_marketing = clientes.aceita_marketing or excluded.aceita_marketing,
       ultimo_login_em = now(), logins = clientes.logins + 1`,
    [email, nome, t.picture ?? null, t.sub, aceitaMarketing]
  );

  // Favoritos salvos antes do login passam para a conta da pessoa
  const visitante = cookies().get(VISITOR_COOKIE)?.value;
  if (visitante && /^[0-9a-f-]{36}$/.test(visitante)) {
    await query(
      `insert into favorites (user_email, property_id)
       select $1, property_id from favorites where user_email = $2
       on conflict do nothing`,
      [email, `visitor:${visitante}`]
    ).catch(() => {});
  }

  const cliente: Cliente = { email, nome, foto: t.picture };
  cookies().set(CLIENTE_COOKIE, assinar(cliente), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 180 });
  return { ok: true, cliente };
}

export async function sairCliente(): Promise<void> {
  cookies().delete(CLIENTE_COOKIE);
}

// ---------- Painel: clientes para marketing ----------
export type ClienteLinha = {
  email: string;
  nome: string | null;
  aceitaMarketing: boolean;
  aceitouTermosEm: string | null;
  criadoEm: string;
  ultimoLoginEm: string;
  logins: number;
  favoritos: number;
};

function exigirEquipe() {
  const s = verifySession(cookies().get('mn_staff')?.value);
  if (!s) throw new Error('Acesso restrito à equipe.');
  return s;
}

export async function listClientes(): Promise<ClienteLinha[]> {
  exigirEquipe();
  const rows = await query<{
    email: string;
    nome: string | null;
    aceita_marketing: boolean;
    aceitou_termos_em: Date | null;
    criado_em: Date;
    ultimo_login_em: Date;
    logins: number;
    favoritos: string;
  }>(
    `select c.*, (select count(*) from favorites f where f.user_email = c.email) as favoritos
       from clientes c order by c.criado_em desc limit 5000`
  );
  const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);
  return rows.map((r) => ({
    email: r.email,
    nome: r.nome,
    aceitaMarketing: r.aceita_marketing,
    aceitouTermosEm: iso(r.aceitou_termos_em),
    criadoEm: iso(r.criado_em)!,
    ultimoLoginEm: iso(r.ultimo_login_em)!,
    logins: r.logins,
    favoritos: Number(r.favoritos) || 0
  }));
}

'use server';

// Painel → Meu perfil: cada pessoa da equipe edita o próprio perfil (foto, nome
// que aparece no site, CRECI, WhatsApp, apresentação e senha).
import bcrypt from 'bcryptjs';
import { query } from './db';
import { exigirEquipe } from './staff-auth';

export type MeuPerfil = { email: string; nome: string; nomePublico: string; foto: string | null; creci: string; telefone: string; bio: string };

export async function lerMeuPerfil(): Promise<MeuPerfil> {
  const eu = await exigirEquipe();
  const r = await query<{ email: string; name: string; nome_publico: string | null; foto: string | null; creci: string | null; telefone: string | null; bio: string | null }>(
    'select email, name, nome_publico, foto, creci, telefone, bio from staff_users where lower(email) = lower($1)',
    [eu.email]
  );
  const p = r[0];
  return {
    email: eu.email,
    nome: p?.name ?? eu.name,
    nomePublico: p?.nome_publico ?? '',
    foto: p?.foto ?? null,
    creci: p?.creci ?? '',
    telefone: p?.telefone ?? '',
    bio: p?.bio ?? ''
  };
}

export async function salvarMeuPerfil(d: {
  nomePublico: string;
  foto: string | null;
  creci: string;
  telefone: string;
  bio: string;
  senhaAtual?: string;
  novaSenha?: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const eu = await exigirEquipe();
  const foto = d.foto && /^https:\/\//.test(d.foto) ? d.foto.slice(0, 500) : null;
  await query('update staff_users set nome_publico = $2, foto = $3, creci = $4, telefone = $5, bio = $6 where lower(email) = lower($1)', [
    eu.email,
    String(d.nomePublico ?? '').trim().slice(0, 80) || null,
    foto,
    String(d.creci ?? '').trim().slice(0, 30) || null,
    String(d.telefone ?? '').replace(/\D/g, '').slice(0, 13) || null,
    String(d.bio ?? '').trim().slice(0, 1500) || null
  ]);
  if (d.novaSenha) {
    if (d.novaSenha.length < 8) return { ok: false, erro: 'A nova senha precisa de pelo menos 8 caracteres. O resto do perfil foi salvo.' };
    const r = await query<{ password_hash: string }>('select password_hash from staff_users where lower(email) = lower($1)', [eu.email]);
    if (!r[0] || !(await bcrypt.compare(String(d.senhaAtual ?? ''), r[0].password_hash)))
      return { ok: false, erro: 'Senha atual incorreta. O resto do perfil foi salvo.' };
    // trocar a senha encerra as outras sessões (os outros aparelhos pedem login de novo)
    await query('update staff_users set password_hash = $2, sessoes_desde = now() where lower(email) = lower($1)', [eu.email, await bcrypt.hash(d.novaSenha, 10)]);
  }
  return { ok: true };
}

/** Lista para o analista/admin escolher o corretor responsável por um anúncio */
export async function listarCorretoresEquipe(): Promise<{ email: string; nome: string }[]> {
  await exigirEquipe();
  const r = await query<{ email: string; name: string; nome_publico: string | null }>('select email, name, nome_publico from staff_users order by name');
  return r.map((x) => ({ email: x.email, nome: x.nome_publico || x.name }));
}

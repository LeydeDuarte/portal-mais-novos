// Perfil público dos corretores (foto, nome e CRECI nos cards e páginas).
// Só dados públicos: nunca o e-mail. Módulo só do servidor.
import { query } from './db';

export type CorretorPublico = { nome: string; foto: string | null; creci: string | null };

/** e-mail → perfil público (uma consulta para todos os e-mails pedidos) */
export async function corretoresPublicos(emails: (string | null | undefined)[]): Promise<Map<string, CorretorPublico>> {
  const lista = Array.from(new Set(emails.filter((e): e is string => !!e).map((e) => e.toLowerCase())));
  const m = new Map<string, CorretorPublico>();
  if (!lista.length) return m;
  const rows = await query<{ email: string; name: string; nome_publico: string | null; foto: string | null; creci: string | null }>(
    'select email, name, nome_publico, foto, creci from staff_users where lower(email) = any($1::text[])',
    [lista]
  ).catch(() => []);
  for (const r of rows) m.set(r.email.toLowerCase(), { nome: (r.nome_publico || r.name).trim(), foto: r.foto, creci: r.creci });
  return m;
}

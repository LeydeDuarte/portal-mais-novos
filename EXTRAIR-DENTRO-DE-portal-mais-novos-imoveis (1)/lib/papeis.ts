// Papéis da equipe (arquivo sem dependências — usado no navegador e no servidor)
export type StaffRole = 'admin' | 'analista' | 'corretor';
/** Admin e analista do admin veem e editam tudo (inclusive o que os corretores cadastram); corretor só o que é dele. */
export const veTudo = (role?: string | null) => role === 'admin' || role === 'analista';
export const ROLE_LABEL: Record<StaffRole, string> = { admin: 'Administrador', analista: 'Analista', corretor: 'Corretor' };

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Conexão com o Neon via HTTP (sem WebSocket/Pool) — formato recomendado
// pelo Neon para funções serverless. A conexão só é criada na primeira
// consulta de verdade (não no momento em que o módulo é importado), pra não
// quebrar em qualquer contexto onde o arquivo é carregado antes da variável
// de ambiente estar disponível (ex: coleta de metadados no build).
let sqlClient: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!sqlClient) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não configurada — confira as variáveis de ambiente na Vercel.');
    }
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const sql = getSql();
  const rows = await sql(text, params);
  return rows as unknown as T[];
}

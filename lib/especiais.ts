// Leitura dos cards especiais para o feed (módulo só do servidor — não vira endpoint).
import { query } from './db';
import type { DepoimentoCard, DestaqueCard } from './especiais-tipos';

export async function depoimentosAtivos(): Promise<DepoimentoCard[]> {
  const rows = await query<{ id: string; nome: string; subtitulo: string | null; texto: string; foto: string | null; nota: number | null }>(
    'select id, nome, subtitulo, texto, foto, nota from depoimentos where ativo order by ordem, created_at desc limit 60'
  ).catch(() => []);
  return rows;
}

export async function destaquesAtivos(): Promise<DestaqueCard[]> {
  const rows = await query<{ id: string; selo: string; titulo: string; texto: string | null; imagem: string | null; link: string | null; botao: string | null }>(
    `select id, selo, titulo, texto, imagem, link, botao from destaques
      where ativo and (inicio is null or inicio <= current_date) and (fim is null or fim >= current_date)
      order by ordem, created_at desc limit 20`
  ).catch(() => []);
  return rows;
}

/** Número estável a partir de um texto (para variar a ordem por visitante) */
export function hashTexto(t: string): number {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return Math.abs(h);
}

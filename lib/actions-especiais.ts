'use server';

// Painel → Depoimentos e Destaques (só admin e analista cadastram).
import { query } from './db';
import { exigirGestor } from './staff-auth';
import type { Depoimento, Destaque } from './especiais-tipos';

const txt = (v: unknown, max: number) => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
};
const urlOk = (v: unknown) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (s.startsWith('/')) return s.slice(0, 500);
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
};
const dataOk = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : null);

// ---------------- Depoimentos ----------------
type DepRow = { id: string; nome: string; subtitulo: string | null; texto: string; foto: string | null; nota: number | null; ativo: boolean; ordem: number; created_at: Date };
const mapDep = (r: DepRow): Depoimento => ({ ...r, criadoEm: new Date(r.created_at).toISOString() });

export async function listarDepoimentos(): Promise<Depoimento[]> {
  await exigirGestor();
  const rows = await query<DepRow>('select * from depoimentos order by ativo desc, ordem, created_at desc');
  return rows.map(mapDep);
}

export type DepoimentoInput = { id?: string; nome: string; subtitulo?: string; texto: string; foto?: string | null; nota?: number | null; ativo: boolean; ordem?: number };

export async function salvarDepoimento(d: DepoimentoInput): Promise<{ ok: boolean; erro?: string }> {
  const eu = await exigirGestor();
  const nome = txt(d.nome, 80);
  const texto = txt(d.texto, 700);
  if (!nome) return { ok: false, erro: 'Informe o nome do cliente.' };
  if (!texto || texto.length < 10) return { ok: false, erro: 'Escreva o depoimento (pelo menos 10 caracteres).' };
  const nota = d.nota && d.nota >= 1 && d.nota <= 5 ? Math.round(d.nota) : null;
  const vals = [nome, txt(d.subtitulo, 120), texto, urlOk(d.foto), nota, !!d.ativo, Math.round(Number(d.ordem) || 0)];
  if (d.id) {
    await query(
      'update depoimentos set nome=$2, subtitulo=$3, texto=$4, foto=$5, nota=$6, ativo=$7, ordem=$8, updated_at=now() where id=$1::uuid',
      [d.id, ...vals]
    );
  } else {
    await query('insert into depoimentos (nome, subtitulo, texto, foto, nota, ativo, ordem, criado_por) values ($1,$2,$3,$4,$5,$6,$7,$8)', [...vals, eu.email]);
  }
  return { ok: true };
}

export async function excluirDepoimento(id: string): Promise<void> {
  await exigirGestor();
  await query('delete from depoimentos where id = $1::uuid', [id]);
}

// ---------------- Destaques (propaganda própria no feed) ----------------
type DestRow = {
  id: string;
  selo: string;
  titulo: string;
  texto: string | null;
  imagem: string | null;
  link: string | null;
  botao: string | null;
  ativo: boolean;
  ordem: number;
  inicio: Date | null;
  fim: Date | null;
  cliques: number;
  exibicoes: number;
  created_at: Date;
};
const dia = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const mapDest = (r: DestRow): Destaque => ({ ...r, inicio: dia(r.inicio), fim: dia(r.fim), criadoEm: new Date(r.created_at).toISOString() });

export async function listarDestaques(): Promise<Destaque[]> {
  await exigirGestor();
  const rows = await query<DestRow>('select * from destaques order by ativo desc, ordem, created_at desc');
  return rows.map(mapDest);
}

export type DestaqueInput = {
  id?: string;
  selo?: string;
  titulo: string;
  texto?: string;
  imagem?: string | null;
  link?: string;
  botao?: string;
  ativo: boolean;
  ordem?: number;
  inicio?: string;
  fim?: string;
};

export async function salvarDestaque(d: DestaqueInput): Promise<{ ok: boolean; erro?: string }> {
  const eu = await exigirGestor();
  const titulo = txt(d.titulo, 90);
  if (!titulo) return { ok: false, erro: 'Informe o título.' };
  if (d.link && !urlOk(d.link)) return { ok: false, erro: 'Link inválido. Use um endereço começando com https:// ou uma página do site (ex.: /financiamento).' };
  const vals = [
    txt(d.selo, 24) ?? 'Destaque',
    titulo,
    txt(d.texto, 300),
    urlOk(d.imagem),
    urlOk(d.link),
    txt(d.botao, 30),
    !!d.ativo,
    Math.round(Number(d.ordem) || 0),
    dataOk(d.inicio),
    dataOk(d.fim)
  ];
  if (d.id) {
    await query(
      'update destaques set selo=$2, titulo=$3, texto=$4, imagem=$5, link=$6, botao=$7, ativo=$8, ordem=$9, inicio=$10, fim=$11, updated_at=now() where id=$1::uuid',
      [d.id, ...vals]
    );
  } else {
    await query(
      'insert into destaques (selo, titulo, texto, imagem, link, botao, ativo, ordem, inicio, fim, criado_por) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [...vals, eu.email]
    );
  }
  return { ok: true };
}

export async function excluirDestaque(id: string): Promise<void> {
  await exigirGestor();
  await query('delete from destaques where id = $1::uuid', [id]);
}

/** Clique no card de destaque (público) — só soma o contador */
export async function contarCliqueDestaque(id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return;
  await query('update destaques set cliques = cliques + 1 where id = $1::uuid', [id]).catch(() => {});
}

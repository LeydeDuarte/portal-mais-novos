'use server';

// Painel → News (admin e analista): notícias, banners, chaves de publicação por IA e indicadores.
import { createHash, randomBytes } from 'crypto';
import { query } from '../db';
import { exigirEquipe } from '../staff-auth';
import { veTudo } from '../papeis';
import { atualizarIndicadores } from '../indicadores';
import { mapNoticia } from './dados';
import { gravarNoticia, type NoticiaEntrada } from './gravar';
import type { Noticia } from './base';

async function exigirEditor() {
  const eu = await exigirEquipe();
  if (!veTudo(eu.role)) throw new Error('Só administrador e analista editam o News.');
  return eu;
}

export async function listarNoticiasAdmin(): Promise<Noticia[]> {
  await exigirEditor();
  const rows = await query<Record<string, unknown>>('select * from noticias order by updated_at desc limit 500');
  return rows.map(mapNoticia);
}

export async function lerNoticiaAdmin(id: string): Promise<Noticia | null> {
  await exigirEditor();
  const rows = await query<Record<string, unknown>>('select * from noticias where id = $1', [id]);
  return rows[0] ? mapNoticia(rows[0]) : null;
}

export async function salvarNoticia(e: NoticiaEntrada) {
  const eu = await exigirEditor();
  return gravarNoticia(e, { email: eu.email, origem: 'painel' });
}

export async function excluirNoticia(id: string): Promise<void> {
  await exigirEditor();
  await query('delete from noticias where id = $1', [id]);
}

// ---------------- banners ----------------
export type Banner = { id: string; posicao: string; imagem: string; link: string | null; titulo: string | null; ativo: boolean; inicio: string | null; fim: string | null; cliques: number };
export async function listarBanners(): Promise<Banner[]> {
  await exigirEditor();
  const rows = await query<Record<string, unknown>>('select * from banners order by created_at desc');
  return rows.map((r) => ({
    id: String(r.id),
    posicao: String(r.posicao),
    imagem: String(r.imagem),
    link: (r.link as string) ?? null,
    titulo: (r.titulo as string) ?? null,
    ativo: !!r.ativo,
    inicio: r.inicio ? String(r.inicio instanceof Date ? r.inicio.toISOString() : r.inicio).slice(0, 10) : null,
    fim: r.fim ? String(r.fim instanceof Date ? r.fim.toISOString() : r.fim).slice(0, 10) : null,
    cliques: Number(r.cliques ?? 0)
  }));
}
export async function salvarBanner(b: Partial<Banner> & { imagem: string; posicao: string }): Promise<{ ok: boolean; erro?: string }> {
  await exigirEditor();
  if (!/^https:\/\//.test(b.imagem ?? '')) return { ok: false, erro: 'Envie a imagem do banner.' };
  if (!['lateral', 'lateral-grande', 'texto', 'topo'].includes(b.posicao)) return { ok: false, erro: 'Posição inválida.' };
  const link = b.link && /^https?:\/\//.test(b.link) ? b.link.slice(0, 500) : null;
  if (b.id) {
    await query('update banners set posicao=$2, imagem=$3, link=$4, titulo=$5, ativo=$6, inicio=$7, fim=$8 where id=$1', [
      b.id, b.posicao, b.imagem, link, b.titulo?.slice(0, 120) ?? null, b.ativo !== false, b.inicio || null, b.fim || null
    ]);
  } else {
    await query('insert into banners (id, posicao, imagem, link, titulo, ativo, inicio, fim) values ($1,$2,$3,$4,$5,$6,$7,$8)', [
      `ban-${randomBytes(5).toString('hex')}`, b.posicao, b.imagem, link, b.titulo?.slice(0, 120) ?? null, b.ativo !== false, b.inicio || null, b.fim || null
    ]);
  }
  return { ok: true };
}
export async function excluirBanner(id: string): Promise<void> {
  await exigirEditor();
  await query('delete from banners where id = $1', [id]);
}

// ---------------- chaves para IA publicar ----------------
export const hashChave = async (chave: string) => createHash('sha256').update(chave).digest('hex');
export async function listarChaves(): Promise<{ id: string; nome: string; criadoEm: string; ultimoUso: string | null; ativa: boolean }[]> {
  await exigirEditor();
  const rows = await query<{ id: string; nome: string; criado_em: Date; ultimo_uso: Date | null; ativa: boolean }>('select * from news_chaves order by criado_em desc');
  return rows.map((r) => ({ id: r.id, nome: r.nome, criadoEm: new Date(r.criado_em).toISOString(), ultimoUso: r.ultimo_uso ? new Date(r.ultimo_uso).toISOString() : null, ativa: r.ativa }));
}
/** Gera a chave e devolve UMA vez (no banco fica só o resumo criptográfico) */
export async function gerarChave(nome: string): Promise<string> {
  const eu = await exigirEditor();
  const chave = `mnn_${randomBytes(24).toString('base64url')}`;
  await query('insert into news_chaves (id, nome, hash, criado_por) values ($1, $2, $3, $4)', [
    `key-${randomBytes(5).toString('hex')}`,
    (nome || 'IA').slice(0, 60),
    await hashChave(chave),
    eu.email
  ]);
  return chave;
}
export async function revogarChave(id: string): Promise<void> {
  await exigirEditor();
  await query('update news_chaves set ativa = false where id = $1', [id]);
}

export async function atualizarIndicadoresAgora() {
  await exigirEditor();
  return atualizarIndicadores();
}

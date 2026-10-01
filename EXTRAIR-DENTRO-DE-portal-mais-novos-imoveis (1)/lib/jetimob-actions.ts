'use server';

import { cookies } from 'next/headers';
import { query } from './db';
import { exigirGestor } from './staff-auth';
import {
  atualizarVisibilidade,
  idsAtivos,
  jetimobConfigurado,
  previaJetimob,
  importarLeadsJetimob,
  processarFotos,
  sincronizarCondominios,
  sincronizarImoveis,
  type ResumoPagina
} from './jetimob';

// Ações do painel "Integração Jetimob" — só a equipe logada.
// Migração: só admin/analista
const equipe = exigirGestor;

export async function statusJetimob(): Promise<{
  configurado: boolean;
  ultimas: { tipo: string; iniciado: string; terminado: string | null; resumo: Record<string, unknown>; erro: string | null }[];
  contagem: { imoveis: number; privados: number; condominios: number; fotosPendentes: number };
}> {
  await equipe();
  const [ult, cont] = await Promise.all([
    query<{ tipo: string; iniciado_em: Date; terminado_em: Date | null; resumo: Record<string, unknown>; erro: string | null }>(
      'select tipo, iniciado_em, terminado_em, resumo, erro from jetimob_sync order by iniciado_em desc limit 8'
    ),
    query<{ imoveis: string; privados: string; condominios: string; fotos: string }>(
      `select (select count(*) from properties where jetimob_id is not null) as imoveis,
              (select count(*) from properties where jetimob_id is not null and visibilidade = 'privado') as privados,
              (select count(*) from developments where jetimob_id is not null) as condominios,
              (select coalesce(sum(jsonb_array_length(fotos_pendentes)), 0) from properties) + (select coalesce(sum(jsonb_array_length(fotos_pendentes)), 0) from developments) as fotos`
    )
  ]);
  const c = cont[0];
  return {
    configurado: jetimobConfigurado(),
    ultimas: ult.map((u) => ({
      tipo: u.tipo,
      iniciado: new Date(u.iniciado_em).toISOString(),
      terminado: u.terminado_em ? new Date(u.terminado_em).toISOString() : null,
      resumo: u.resumo,
      erro: u.erro
    })),
    contagem: { imoveis: Number(c?.imoveis) || 0, privados: Number(c?.privados) || 0, condominios: Number(c?.condominios) || 0, fotosPendentes: Number(c?.fotos) || 0 }
  };
}

export async function testarJetimob() {
  await equipe();
  try {
    return { ok: true as const, ...(await previaJetimob()) };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : 'Falha ao conectar.' };
  }
}

export async function iniciarSync(tipo: 'completa' | 'manual'): Promise<{ id: number; inicio: string }> {
  await equipe();
  const r = await query<{ id: number; iniciado_em: Date }>('insert into jetimob_sync (tipo) values ($1) returning id, iniciado_em', [tipo]);
  return { id: r[0].id, inicio: new Date(r[0].iniciado_em).toISOString() };
}

export async function syncCondominiosPagina(pagina: number, trocarFotos = false): Promise<ResumoPagina> {
  const s = await equipe();
  return sincronizarCondominios(pagina, s.email, trocarFotos);
}

export async function syncImoveisPagina(pagina: number, trocarFotos = false): Promise<ResumoPagina> {
  const s = await equipe();
  const ativos = await idsAtivos();
  return sincronizarImoveis(pagina, s.email, { ativos, trocarFotos });
}

// Migração: nada é apagado do portal quando some da Jetimob (ela vai ser desligada)
export async function finalizarSync(id: number, resumo: Record<string, unknown>): Promise<void> {
  await equipe();
  await query('update jetimob_sync set terminado_em = now(), resumo = $2::jsonb where id = $1', [id, JSON.stringify(resumo)]);
}

export async function importarContatosJetimob() {
  await equipe();
  try {
    return { ok: true as const, ...(await importarLeadsJetimob()) };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : 'falha' };
  }
}

export async function syncFotos(): Promise<{ enviadas: number; restantes: number; erros: string[] }> {
  await equipe();
  return processarFotos(20000);
}

export async function syncVisibilidade(): Promise<number> {
  await equipe();
  return atualizarVisibilidade(await idsAtivos());
}

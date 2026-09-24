'use server';

import { cookies } from 'next/headers';
import { query } from './db';
import { verifySession } from './session';

// Conta uma visualização quando alguém abre a página do imóvel/condomínio.
// A equipe logada não conta; o navegador evita contar de novo na mesma sessão.
export async function registrarVisita(tipo: 'imovel' | 'empreendimento', id: string): Promise<void> {
  if (verifySession(cookies().get('mn_staff')?.value)) return;
  if (!id || id.length > 80) return;
  await query(`update ${tipo === 'imovel' ? 'properties' : 'developments'} set visualizacoes = visualizacoes + 1 where id = $1`, [id]).catch(() => {});
}

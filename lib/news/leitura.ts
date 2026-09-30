'use server';
import { contarLeitura } from './dados';
import { staffAtual } from '../staff-auth';

/** +1 leitura (equipe logada não conta) */
export async function registrarLeituraNoticia(id: string): Promise<void> {
  if (typeof id !== 'string' || id.length > 40) return;
  if (await staffAtual().catch(() => null)) return;
  await contarLeitura(id);
}

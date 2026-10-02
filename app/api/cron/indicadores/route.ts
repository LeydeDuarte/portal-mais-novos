import { NextResponse } from 'next/server';
import { atualizarIndicadores } from '@/lib/indicadores';
import { importarCapasExternas } from '@/lib/news/capa';

// Chamado pela Vercel uma vez por dia (vercel.json → crons). Com a variável
// CRON_SECRET configurada, só aceita a chamada da própria Vercel.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }
  const res = await atualizarIndicadores();
  // reserva: capas de notícias que ainda estão em links de fora
  const capas = await importarCapasExternas(10).catch(() => 0);
  return NextResponse.json({ ok: true, res, capas });
}

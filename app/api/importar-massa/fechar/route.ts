import { NextResponse } from 'next/server';
import { staffAtual } from '@/lib/staff-auth';
import { veTudo } from '@/lib/papeis';
import { finalizarPasta } from '@/lib/importar-massa';

// Fim de uma pasta da importação em massa: escreve a descrição (se faltar) e organiza as fotos.
// Rota própria (e não ação do painel) porque escrever a descrição leva até ~50 s.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const s = await staffAtual();
  if (!s || !veTudo(s.role)) return NextResponse.json({ erro: 'Só administrador ou analista.' }, { status: 401 });
  const { devId } = (await request.json().catch(() => ({}))) as { devId?: string };
  if (!devId) return NextResponse.json({ erro: 'devId' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await finalizarPasta(devId)) });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message.slice(0, 200) : 'falha' }, { status: 500 });
  }
}

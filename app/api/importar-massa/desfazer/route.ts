import { NextResponse } from 'next/server';
import { staffAtual } from '@/lib/staff-auth';
import { veTudo } from '@/lib/papeis';
import { desfazerImportacao } from '@/lib/importar-massa';

// Desfaz a importação em massa de um condomínio (fotos, plantas, tipologias criadas, descrição gerada).
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const s = await staffAtual();
  if (!s || !veTudo(s.role)) return NextResponse.json({ erro: 'Só administrador ou analista.' }, { status: 401 });
  const { devId } = (await request.json().catch(() => ({}))) as { devId?: string };
  if (!devId) return NextResponse.json({ erro: 'devId' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await desfazerImportacao(devId)) });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message.slice(0, 200) : 'falha' }, { status: 500 });
  }
}

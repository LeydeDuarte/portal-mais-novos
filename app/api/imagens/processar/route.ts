import { NextResponse } from 'next/server';
import { processarFilaImagens } from '@/lib/imagens-fila';

// Processa a fila de imagens (fotos e plantas de condomínios). Pode ser chamada por qualquer um:
// só trabalha o que já está na fila, gravada por quem tem acesso ao banco.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const r = await processarFilaImagens(45000);
  return NextResponse.json({ ok: true, ...r });
}

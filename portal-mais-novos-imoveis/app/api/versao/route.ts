import { NextResponse } from 'next/server';

// Versão publicada agora no servidor. O navegador/app compara com a versão que
// está rodando nele; se for diferente, aparece o botão "Atualizar versão".
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ v: process.env.NEXT_PUBLIC_VERSAO ?? '' }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

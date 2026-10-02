import { NextResponse } from 'next/server';
import { importarCapaExterna } from '@/lib/news/capa';

// Copia para o portal a capa de uma notícia que está num link de fora (ex.: arquivo exportado
// do Canva pelo projeto "Mais Novos News"), antes que o link expire. Só mexe na capa da
// própria notícia: não aceita endereço de imagem nem qualquer outro dado.
//   GET /api/news/capa?id=not-xxxxxxxxxxxx
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^not-[a-z0-9]{6,20}$/.test(id)) return NextResponse.json({ ok: false, erro: 'id inválido' }, { status: 400 });
  const copiada = await importarCapaExterna(id).catch(() => false);
  return NextResponse.json({ ok: true, copiada });
}

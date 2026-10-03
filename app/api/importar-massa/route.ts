import { NextResponse } from 'next/server';
import { staffAtual } from '@/lib/staff-auth';
import { veTudo } from '@/lib/papeis';
import { importarArquivo, importarPlanilha } from '@/lib/importar-massa';

// Recebe UM arquivo já reduzido pelo navegador (máx. ~2400 px, JPEG) da importação em massa.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const s = await staffAtual();
  if (!s || !veTudo(s.role)) return NextResponse.json({ erro: 'Só administrador ou analista.' }, { status: 401 });
  try {
    const f = await request.formData();
    const arquivo = f.get('arquivo');
    const devId = String(f.get('devId') ?? '');
    const hash = String(f.get('hash') ?? '');
    const nome = String(f.get('nome') ?? '');
    const texto = f.get('texto');
    // planilha (Excel/CSV) convertida em texto no navegador
    if (typeof texto === 'string' && texto.trim()) {
      if (!devId || !/^[a-f0-9]{40,64}$/.test(hash)) return NextResponse.json({ erro: 'dados incompletos' }, { status: 400 });
      const r = await importarPlanilha(devId, hash, nome, texto.slice(0, 80000));
      return NextResponse.json({ ok: true, ...r });
    }
    if (!(arquivo instanceof Blob) || !devId || !/^[a-f0-9]{40,64}$/.test(hash)) return NextResponse.json({ erro: 'dados incompletos' }, { status: 400 });
    if (arquivo.size > 4 * 1024 * 1024) return NextResponse.json({ erro: 'arquivo grande demais' }, { status: 400 });
    const r = await importarArquivo(devId, hash, nome, Buffer.from(await arquivo.arrayBuffer()), arquivo.type || 'image/jpeg');
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message.slice(0, 200) : 'falha' }, { status: 500 });
  }
}

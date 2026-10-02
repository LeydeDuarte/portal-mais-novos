import { NextResponse } from 'next/server';
import { imoveisEmDestaque } from '@/lib/news/imoveis';
import { regiaoDoVisitante } from '@/lib/news/regiao-visitante';
import { UFS } from '@/lib/news/base';

// Imóveis à venda perto do visitante (cidade escolhida no seletor do News ou a
// localização aproximada pela internet). Sem imóveis na cidade dele, Goiânia.
export const dynamic = 'force-dynamic';

const sa = (t: string | null | undefined) => (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export async function GET() {
  const r = regiaoDoVisitante();
  const cidade = r.cidade ?? 'Goiânia';
  const itens = await imoveisEmDestaque(4, cidade).catch(() => []);
  const daCidade = itens.some((i) => sa(i.cidade) === sa(cidade));
  return NextResponse.json(
    { cidade: daCidade ? cidade : null, uf: daCidade ? r.uf : null, estado: UFS[r.uf] ?? null, itens },
    { headers: { 'cache-control': 'private, max-age=300' } }
  );
}

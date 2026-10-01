import { NextResponse } from 'next/server';
import { lancamentosPorIncorporadora } from '@/lib/news/mercado';
import { regiaoDoVisitante } from '@/lib/news/regiao-visitante';
import { UFS } from '@/lib/news/base';

// Top 10 incorporadoras do ESTADO do visitante (escolhido no seletor ou pela localização); sem dados, Goiás.
export const dynamic = 'force-dynamic';

export async function GET() {
  const r = regiaoDoVisitante();
  let dados = await lancamentosPorIncorporadora(null, 10, r.uf);
  let nome = UFS[r.uf] ?? r.uf;
  if (!dados.length) {
    dados = await lancamentosPorIncorporadora(null, 10, 'GO');
    nome = 'Goiás';
  }
  return NextResponse.json({ nome, dados }, { headers: { 'cache-control': 'private, max-age=300' } });
}

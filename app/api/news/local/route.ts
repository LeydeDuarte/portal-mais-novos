import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { regioesComNoticias } from '@/lib/news/dados';
import { UFS, slugNews, urlRegiao } from '@/lib/news/base';

// Região do visitante para o News: primeiro a que ele escolheu (cookie), senão a
// da localização aproximada pela internet (a Vercel informa estado e cidade, sem
// pedir permissão). Só devolve região que tem notícia publicada.
export const dynamic = 'force-dynamic';

export async function GET() {
  const regioes = await regioesComNoticias();
  const achar = (uf?: string | null, cidade?: string | null) => {
    if (!uf || !UFS[uf]) return null;
    const c = cidade ? regioes.find((r) => r.uf === uf && r.cidade && slugNews(r.cidade) === slugNews(cidade)) : null;
    if (c) return { uf, cidade: c.cidade, nome: `${c.cidade} · ${uf}`, url: urlRegiao(uf, c.cidade) };
    if (regioes.some((r) => r.uf === uf && !r.cidade)) return { uf, cidade: null, nome: UFS[uf], url: urlRegiao(uf) };
    return null;
  };
  const escolha = cookies().get('mnn_regiao')?.value;
  if (escolha === 'todas') return NextResponse.json({ origem: 'escolha', regiao: null });
  if (escolha) {
    const [uf, cidade] = decodeURIComponent(escolha).split('|');
    const r = achar(uf, cidade || null);
    if (r) return NextResponse.json({ origem: 'escolha', regiao: r });
  }
  const h = headers();
  const pais = h.get('x-vercel-ip-country');
  const uf = (h.get('x-vercel-ip-country-region') ?? '').toUpperCase();
  const cidade = decodeURIComponent(h.get('x-vercel-ip-city') ?? '');
  const r = pais === 'BR' ? achar(uf, cidade) : null;
  return NextResponse.json({ origem: r ? 'local' : 'nenhuma', regiao: r });
}

import { NextResponse } from 'next/server';
import { imoveisDoBairro, imoveisEmDestaque } from '@/lib/news/imoveis';
import { regiaoDoVisitante } from '@/lib/news/regiao-visitante';
import { lerPerfilFeed } from '@/lib/perfil';

// Sugestões de imóveis à venda para as páginas do News, com a "inteligência" do portal:
//  1. a cidade da página (região do News) ou a de quem está vendo (seletor ou internet);
//  2. o PERFIL do visitante (os bairros, tipos e faixa de preço que ele filtra e abre
//     no portal, guardados no cookie mn_perfil): primeiro os bairros dele, depois a cidade;
//  3. dentro disso, primeiro o que bate com os tipos e o preço que ele procura.
// Sem imóveis na cidade dele, os destaques gerais.
export const dynamic = 'force-dynamic';

const sa = (t: string | null | undefined) => (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const r = regiaoDoVisitante();
  const cidade = (url.searchParams.get('cidade') || r.cidade || 'Goiânia').slice(0, 80);
  const uf = (url.searchParams.get('uf') || r.uf || 'GO').slice(0, 2).toUpperCase();
  const perfil = lerPerfilFeed();

  type Item = Awaited<ReturnType<typeof imoveisEmDestaque>>[number];
  const vistos = new Set<string>();
  const lista: Item[] = [];
  const somar = (xs: Item[], filtro?: (i: Item) => boolean) => {
    for (const i of xs) if (!vistos.has(i.id) && (!filtro || filtro(i))) (vistos.add(i.id), lista.push(i));
  };
  // bairros do perfil (só os da mesma cidade contam)
  for (const b of perfil.bairros.slice(0, 3)) {
    const xs = await imoveisDoBairro(b, cidade, 6).catch(() => []);
    somar(xs, (i) => sa(i.bairro) === sa(b) && sa(i.cidade) === sa(cidade));
  }
  const usouPerfil = lista.length > 0;
  // a cidade
  somar(await imoveisEmDestaque(8, cidade).catch(() => []), (i) => sa(i.cidade) === sa(cidade));
  const daCidade = lista.length > 0;
  if (!daCidade) somar(await imoveisEmDestaque(4).catch(() => []));

  // ordena pelo que a pessoa procura: tipo e faixa de preço do perfil
  const nota = (i: Item) => {
    let n = 0;
    if (perfil.tipos.includes(i.tipoUnidade)) n += 2;
    const v = Number(String(i.price ?? '').replace(/\D/g, '')) || 0;
    if (v && (perfil.precoMin == null || v >= perfil.precoMin * 0.8) && (perfil.precoMax == null || v <= perfil.precoMax * 1.2)) n += perfil.precoMin || perfil.precoMax ? 2 : 0;
    if (perfil.bairros.some((b) => sa(b) === sa(i.bairro))) n += 1;
    return n;
  };
  const itens = lista
    .map((i, k) => ({ i, k, n: nota(i) }))
    .sort((a, b) => b.n - a.n || a.k - b.k)
    .slice(0, 4)
    .map((x) => x.i);

  return NextResponse.json(
    {
      cidade: daCidade ? cidade : null,
      uf: daCidade ? uf : null,
      titulo: !daCidade ? 'Imóveis à venda' : usouPerfil ? `Imóveis à venda para você em ${cidade}` : `Imóveis à venda em ${cidade}`,
      subtitulo: !daCidade
        ? 'Escolhidos pela equipe. Muda a cada visita.'
        : usouPerfil
          ? 'Pelos bairros e imóveis que você tem olhado no portal.'
          : 'Perto de você. Muda a cada visita.',
      itens
    },
    { headers: { 'cache-control': 'private, max-age=120' } }
  );
}

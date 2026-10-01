// Monta a 1ª página do feed NO SERVIDOR (home e lançamentos): aparece na hora,
// sem esperar o JavaScript, e o Google/IA encontram os links dos anúncios.
import { getFeedPage, contarImoveisAVenda, feedModoEquipe, getDestaquesFeed } from './actions';
import { DEFAULT_FILTERS, splitTermos, type FilterState } from './filters';
import type { FeedInicial } from '@/components/MasonryFeed';
import { cookies } from 'next/headers';

export async function montarFeedInicial(modo: FilterState['modo'], q: string): Promise<FeedInicial> {
  const filtros: FilterState = { ...DEFAULT_FILTERS, modo, termos: splitTermos(q) };
  // os destaques (espaços de 2 colunas) vêm junto: se chegassem depois, empurrariam o feed (layout shift)
  const [pagina, totalAVenda, modoEquipe, destaques] = await Promise.all([
    getFeedPage(0, filtros).catch(() => ({ items: [], hasMore: true })),
    contarImoveisAVenda().catch(() => 0),
    feedModoEquipe().catch(() => false),
    getDestaquesFeed(filtros).catch(() => [])
  ]);
  const total = 'total' in pagina && typeof pagina.total === 'number' ? pagina.total : totalAVenda;
  // formato do feed escolhido pela pessoa (fica gravado até ela trocar de novo)
  const c = cookies().get('mn_feed')?.value;
  const modoFeed = c === 'alinhado' ? 'alinhado' : 'masonry';
  return { items: pagina.items, hasMore: pagina.hasMore, totalAVenda: total, modoEquipe, filtrosChave: JSON.stringify(filtros), modoFeed, escolheuFeed: !!c, destaques };
}

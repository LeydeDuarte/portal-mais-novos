// Monta a 1ª página do feed NO SERVIDOR (home e lançamentos): aparece na hora,
// sem esperar o JavaScript, e o Google/IA encontram os links dos anúncios.
import { getFeedPage, contarImoveisAVenda, feedModoEquipe } from './actions';
import { DEFAULT_FILTERS, splitTermos, type FilterState } from './filters';
import type { FeedInicial } from '@/components/MasonryFeed';

export async function montarFeedInicial(modo: FilterState['modo'], q: string): Promise<FeedInicial> {
  const filtros: FilterState = { ...DEFAULT_FILTERS, modo, termos: splitTermos(q) };
  const [pagina, totalAVenda, modoEquipe] = await Promise.all([
    getFeedPage(0, filtros).catch(() => ({ items: [], hasMore: true })),
    contarImoveisAVenda().catch(() => 0),
    feedModoEquipe().catch(() => false)
  ]);
  return { items: pagina.items, hasMore: pagina.hasMore, totalAVenda, modoEquipe, filtrosChave: JSON.stringify(filtros) };
}

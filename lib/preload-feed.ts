// Avisa o navegador, logo no começo da página, quais são as primeiras fotos do feed
// (as que aparecem na primeira tela). Ele começa a baixar antes de montar o resto.
import { preload } from 'react-dom';
import type { FeedItem } from './actions';

const foto = (i: FeedItem): string | null => {
  if (i.kind === 'imovel') return i.property.capaMini || i.property.photos?.[0] || null;
  if (i.kind === 'empreendimento') return i.development.capaMini || i.development.photos?.[0] || null;
  return null;
};

export function preloadPrimeirasFotos(items: FeedItem[], quantas = 2) {
  let n = 0;
  for (const it of items) {
    const url = foto(it);
    if (!url) continue;
    preload(url, { as: 'image', fetchPriority: 'high' });
    if (++n >= quantas) break;
  }
}

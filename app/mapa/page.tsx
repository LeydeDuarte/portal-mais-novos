import type { Metadata } from 'next';
import MapaPublico from '@/components/mapa/MapaPublico';

export const metadata: Metadata = {
  title: 'Mapa de imóveis e lançamentos em Goiânia',
  description:
    'Veja no mapa os lançamentos, prédios novos, condomínios e imóveis à venda em Goiânia, com preço em cada ponto, fase da obra e a posição do sol de cada prédio.',
  alternates: { canonical: '/mapa' }
};

export default function MapaPage() {
  return (
    <main id="conteudo">
      <MapaPublico />
    </main>
  );
}

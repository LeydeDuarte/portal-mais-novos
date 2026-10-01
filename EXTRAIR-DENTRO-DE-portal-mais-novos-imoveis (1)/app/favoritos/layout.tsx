import type { Metadata } from 'next';

// Página pessoal (favoritos de cada visitante) — fora do Google
export const metadata: Metadata = { title: 'Meus favoritos', robots: { index: false, follow: false } };

export default function FavoritosLayout({ children }: { children: React.ReactNode }) {
  return children;
}

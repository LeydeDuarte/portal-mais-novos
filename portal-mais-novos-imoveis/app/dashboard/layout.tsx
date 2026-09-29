import type { Metadata } from 'next';

// Área da equipe — nunca deve ser indexada, além do disallow em robots.ts.
export const metadata: Metadata = {
  title: 'Painel da equipe',
  robots: { index: false, follow: false }
};

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import MolduraCrm from '@/components/crm/MolduraCrm';
import GuardaCorretor from '@/components/painel/GuardaCorretor';

// Área da equipe — nunca deve ser indexada, além do disallow em robots.ts.
export const metadata: Metadata = {
  title: 'Painel da equipe',
  robots: { index: false, follow: false }
};

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  // telas de relacionamento (CRM, propostas, proprietários...) ganham o menu lateral do CRM
  return (
    <Suspense fallback={children}>
      <GuardaCorretor />
      <MolduraCrm>{children}</MolduraCrm>
    </Suspense>
  );
}

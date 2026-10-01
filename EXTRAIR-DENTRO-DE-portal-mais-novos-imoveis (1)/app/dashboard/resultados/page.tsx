'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import PainelDados from '@/components/painel/PainelDados';
import OnlineAgora from '@/components/painel/OnlineAgora';
import { useStaffSession } from '@/lib/use-staff-session';

// Painel → Resultados: dados do portal inteiro. Só o administrador principal vê.
export default function ResultadosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
    else if (loaded && staff && staff.role !== 'admin') router.replace('/dashboard');
  }, [loaded, staff, router]);
  if (!loaded || !staff || staff.role !== 'admin') return <PainelNav />;
  return (
    <div className="min-h-screen">
      <PainelNav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 md:px-6">
        <OnlineAgora />
        <div className="mt-8">
          <PainelDados />
        </div>
      </main>
    </div>
  );
}

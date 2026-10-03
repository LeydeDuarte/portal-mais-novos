'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import PainelDados from '@/components/painel/PainelDados';
import OnlineAgora from '@/components/painel/OnlineAgora';
import ResumoCustos from '@/components/painel/ResumoCustos';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';

// Painel → Resultados: dados do portal inteiro.
// Administrador principal: tudo aberto + custos, comparativo e planilhas.
// Analista: os mesmos números, sem custos, com os blocos recolhidos (abre o que quiser).
export default function ResultadosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const pode = !!staff && veTudo(staff.role);
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
    else if (loaded && staff && !veTudo(staff.role)) router.replace('/dashboard');
  }, [loaded, staff, router]);
  if (!loaded || !pode) return <PainelNav />;
  const admin = staff.role === 'admin';
  return (
    <div className="min-h-screen">
      <PainelNav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 md:px-6">
        <OnlineAgora />
        {admin && <ResumoCustos />}
        <div className="mt-8">
          <PainelDados admin={admin} />
        </div>
      </main>
    </div>
  );
}

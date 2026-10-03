'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { getPropertiesByCorretor } from '@/lib/actions';
import { temAcessoFinanceiro } from '@/lib/actions-custos';
import InicioPainel from '@/components/painel/InicioPainel';
import { CORES_DO_CEU, type FaseDoDia } from '@/lib/frases';

export default function PainelPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);
  const [financeiro, setFinanceiro] = useState(false);
  const [fase, setFase] = useState<FaseDoDia | undefined>();
  useEffect(() => {
    // ?ceu=noite (ou manha, tarde, entardecer) só para conferir as cenas
    const f = new URLSearchParams(window.location.search).get('ceu');
    if (f && f in CORES_DO_CEU) setFase(f as FaseDoDia);
  }, []);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
    // o papel Financeiro só tem a tela de custos
    else if (loaded && staff?.role === 'financeiro') router.replace('/dashboard/custos');
  }, [loaded, staff, router]);

  useEffect(() => {
    if (!staff) return;
    getPropertiesByCorretor(staff.email, veTudo(staff.role)).then((rows) => setCount(rows.length)).catch(() => {});
    temAcessoFinanceiro().then(setFinanceiro).catch(() => setFinanceiro(false));
  }, [staff]);

  if (!loaded || !staff) return null;
  return <InicioPainel staff={staff} count={count} financeiro={financeiro} fase={fase} />;
}

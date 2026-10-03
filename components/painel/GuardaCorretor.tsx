'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStaffSession } from '@/lib/use-staff-session';

// Corretor só usa: Início, CRM (e o que é de relacionamento), Meus imóveis, Condomínios
// (sem editar), Mapa e Meu perfil. Aberta pelo endereço direto, outra tela volta ao Início.
// (As ações dessas telas também são recusadas no servidor.)
const PROIBIDAS = [
  /^\/dashboard\/(mercado|monitoramento|empresas|cadastro-ia|importar-pdf|importar-imagens|avaliacoes|tabelas|news|feed-especiais|resultados|equipe|jetimob|avisos)(\/|$)/,
  /^\/dashboard\/condominios\/(importar|duplicados)(\/|$)/,
  /^\/dashboard\/condominios\/[^/]+\/editar(\/|$)/,
  /^\/dashboard\/crm\/(equipe|ia)(\/|$)/
];

export default function GuardaCorretor() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { staff } = useStaffSession();
  useEffect(() => {
    if (staff?.role === 'corretor' && PROIBIDAS.some((re) => re.test(pathname))) router.replace('/dashboard');
  }, [staff, pathname, router]);
  return null;
}

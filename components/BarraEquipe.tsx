'use client';

import { useEffect, useState } from 'react';
import { getStaffSession } from '@/lib/actions';
import { DASHBOARD_URL } from '@/lib/dominios';

// Faixa que SÓ a equipe logada vê nas páginas de anúncio e de condomínio:
// atalhos para editar e para fazer uma proposta (as propostas nunca são públicas).
export default function BarraEquipe({ tipo, id }: { tipo: 'imovel' | 'condominio'; id: string }) {
  const [equipe, setEquipe] = useState(false);
  useEffect(() => {
    getStaffSession()
      .then((s) => setEquipe(!!s))
      .catch(() => {});
  }, []);
  if (!equipe) return null;
  const editar = tipo === 'imovel' ? `${DASHBOARD_URL}/imoveis/${id}/editar` : `${DASHBOARD_URL}/condominios/${id}/editar`;
  const proposta = `${DASHBOARD_URL}/propostas/nova?${tipo === 'imovel' ? 'imovel' : 'condominio'}=${encodeURIComponent(id)}`;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white">
      <span className="text-xs font-bold uppercase tracking-wide opacity-70">Equipe</span>
      <a href={proposta} className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold">
        Fazer proposta
      </a>
      <a href={editar} className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold">
        Editar
      </a>
      <span className="ml-auto text-[11px] opacity-60">só você vê esta faixa</span>
    </div>
  );
}

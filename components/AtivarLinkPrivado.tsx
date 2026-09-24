'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ativarLinkPrivado } from '@/lib/links-privados';

// Primeira abertura do link privado: prende o link a este aparelho e recarrega.
// Roda só no navegador — a prévia do WhatsApp não executa isso e não gasta o link.
export default function AtivarLinkPrivado({ propertyId, linkId }: { propertyId: string; linkId: string }) {
  const router = useRouter();
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    ativarLinkPrivado(propertyId, linkId)
      .then((ok) => (ok ? router.refresh() : setFalhou(true)))
      .catch(() => setFalhou(true));
  }, [propertyId, linkId, router]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
      {falhou ? 'Não foi possível abrir este link neste aparelho. Fale com o nosso atendimento.' : 'Abrindo o anúncio exclusivo…'}
    </div>
  );
}

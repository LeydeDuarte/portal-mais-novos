'use client';

import { useEffect } from 'react';
import { registrarVisita } from '@/lib/visitas';

export default function ContarVisita({ tipo, id }: { tipo: 'imovel' | 'empreendimento'; id: string }) {
  useEffect(() => {
    const chave = `mn_visto_${tipo}_${id}`;
    try {
      if (sessionStorage.getItem(chave)) return;
      sessionStorage.setItem(chave, '1');
    } catch {
      /* navegador sem sessionStorage: conta mesmo assim */
    }
    registrarVisita(tipo, id).catch(() => {});
  }, [tipo, id]);
  return null;
}

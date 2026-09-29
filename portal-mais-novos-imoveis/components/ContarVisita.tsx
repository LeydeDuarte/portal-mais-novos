'use client';

import { useEffect } from 'react';
import { registrarVisita } from '@/lib/visitas';
import { aprenderPerfil } from '@/lib/perfil-cliente';

export default function ContarVisita({
  tipo,
  id,
  perfil
}: {
  tipo: 'imovel' | 'empreendimento';
  id: string;
  perfil?: { tipos?: string[]; bairros?: string[]; preco?: number | null };
}) {
  useEffect(() => {
    // o que a pessoa abre ensina o feed a mostrar mais do que ela procura
    if (perfil) aprenderPerfil({ ...perfil, peso: 1 });
    const chave = `mn_visto_${tipo}_${id}`;
    try {
      if (sessionStorage.getItem(chave)) return;
      sessionStorage.setItem(chave, '1');
    } catch {
      /* navegador sem sessionStorage: conta mesmo assim */
    }
    registrarVisita(tipo, id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, id]);
  return null;
}

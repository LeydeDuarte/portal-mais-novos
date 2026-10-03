'use client';

// Aparelho da equipe: avisa o portal uma vez por sessão. O identificador anônimo deste
// navegador entra na lista de aparelhos da equipe, e as visitas dele saem das estatísticas
// (inclusive as feitas antes do login ou depois de sair).
import { useEffect } from 'react';

export default function MarcarAparelhoEquipe() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('mn_eq')) return;
      sessionStorage.setItem('mn_eq', '1');
    } catch {
      /* sem sessionStorage: manda mesmo assim */
    }
    fetch('/api/ev', { method: 'POST', body: JSON.stringify({ t: 'equipe' }), keepalive: true }).catch(() => {});
  }, []);
  return null;
}

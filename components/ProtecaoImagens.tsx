'use client';

import { useEffect } from 'react';

// Fotos do site: sem "salvar imagem" (botão direito / toque longo) e sem arrastar
// para a área de trabalho. Não impede 100% (print sempre é possível), mas tira o caminho fácil.
export default function ProtecaoImagens() {
  useEffect(() => {
    const bloquear = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'IMG' || t.closest?.('[data-protegido]'))) e.preventDefault();
    };
    document.addEventListener('contextmenu', bloquear);
    document.addEventListener('dragstart', bloquear);
    return () => {
      document.removeEventListener('contextmenu', bloquear);
      document.removeEventListener('dragstart', bloquear);
    };
  }, []);
  return null;
}

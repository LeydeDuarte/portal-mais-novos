'use client';

import { useEffect, useState } from 'react';

// Anúncio exclusivo (link privado): dificulta print e cópia.
// - Nenhum site consegue deixar o print preto (isso só existe em app nativo);
//   por isso as fotos levam a marca d'água com o telefone de quem recebeu.
// - Ao sair da página/trocar de app, o conteúdo fica embaçado (a miniatura na
//   lista de apps abertos sai borrada) e a impressão sai em branco.
export default function ProtecaoTela() {
  const [oculto, setOculto] = useState(false);
  useEffect(() => {
    const vis = () => (document.visibilityState === 'visible' ? setOculto(false) : setOculto(true));
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        setOculto(true);
        navigator.clipboard?.writeText('').catch(() => {});
        setTimeout(() => setOculto(false), 1500);
      }
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('keyup', tecla);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('keyup', tecla);
    };
  }, []);
  return (
    <>
      <style>{`@media print { body { display: none !important; } } body { -webkit-user-select: none; user-select: none; }`}</style>
      {oculto && <div className="fixed inset-0 z-[200] bg-white/60 backdrop-blur-2xl" aria-hidden />}
    </>
  );
}

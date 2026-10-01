'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoginModal from '@/components/LoginModal';
import { useSession } from '@/lib/use-session';

/** Botão "Entrar para ver": abre o login com Google e, ao entrar, recarrega a página liberada */
export default function EntrarParaVer({ rotulo = 'Entrar para ver o ranking completo', titulo = 'Entre para ver o ranking completo' }: { rotulo?: string; titulo?: string }) {
  const [aberto, setAberto] = useState(false);
  const { signIn } = useSession();
  const router = useRouter();
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="h-12 rounded-full bg-accent px-6 text-[15px] font-bold text-white hover:brightness-95">
        {rotulo}
      </button>
      <LoginModal
        open={aberto}
        onClose={() => setAberto(false)}
        titulo={titulo}
        texto="É grátis e leva 5 segundos. Você também pode salvar imóveis nos favoritos."
        onSignIn={(c) => {
          signIn(c);
          setAberto(false);
          router.refresh();
        }}
      />
    </>
  );
}

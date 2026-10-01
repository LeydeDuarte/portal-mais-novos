'use client';

import { useEffect, useState } from 'react';

// Aviso flutuante "Atualizar versão". O app instalado (PWA) e as abas que ficam
// abertas muito tempo continuam com a versão antiga depois de uma publicação e
// podem travar (telas que não abrem, botões que não salvam). Aqui:
//  - confere a versão do servidor ao abrir, ao voltar para o app e a cada 5 min;
//  - também percebe os erros típicos de versão velha (pedaço do site não encontrado);
//  - mostra o botão; ao tocar, atualiza o service worker e recarrega.
const ATUAL = process.env.NEXT_PUBLIC_VERSAO ?? '';

export default function AtualizarVersao() {
  const [nova, setNova] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    if (!ATUAL) return;
    let parado = false;
    const conferir = async () => {
      if (parado || document.visibilityState !== 'visible') return;
      try {
        const r = await fetch('/api/versao', { cache: 'no-store' });
        const j = (await r.json()) as { v?: string };
        if (j.v && j.v !== ATUAL) setNova(true);
      } catch {
        /* sem internet: tenta depois */
      }
    };
    const primeira = setTimeout(conferir, 15000);
    const intervalo = setInterval(conferir, 5 * 60 * 1000);
    const aoVoltar = () => document.visibilityState === 'visible' && conferir();
    document.addEventListener('visibilitychange', aoVoltar);
    // erro de versão velha: arquivo do site que não existe mais / ação do servidor trocada
    const erroVelho = (msg: string) => /ChunkLoadError|Loading chunk|dynamically imported module|Failed to find Server Action|Server Action/i.test(msg);
    const onErro = (e: ErrorEvent) => erroVelho(String(e.message ?? '')) && setNova(true);
    const onRejeitado = (e: PromiseRejectionEvent) => erroVelho(String((e.reason as Error)?.message ?? e.reason ?? '')) && setNova(true);
    window.addEventListener('error', onErro);
    window.addEventListener('unhandledrejection', onRejeitado);
    return () => {
      parado = true;
      clearTimeout(primeira);
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('error', onErro);
      window.removeEventListener('unhandledrejection', onRejeitado);
    };
  }, []);

  const atualizar = async () => {
    setAtualizando(true);
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      reg?.waiting?.postMessage('pular-espera');
    } catch {
      /* segue para recarregar */
    }
    window.location.reload();
  };

  if (!nova) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-2 pl-5 pr-2 text-[13px] text-white shadow-[0_12px_32px_rgba(0,0,0,0.28)]" role="status">
      <span className="whitespace-nowrap">Nova versão disponível</span>
      <button type="button" onClick={atualizar} disabled={atualizando} className="whitespace-nowrap rounded-full bg-accent px-4 py-2 font-bold disabled:opacity-70">
        {atualizando ? 'Atualizando…' : 'Atualizar versão'}
      </button>
    </div>
  );
}

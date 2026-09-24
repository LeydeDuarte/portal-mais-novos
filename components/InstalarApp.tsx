'use client';

import { useEffect, useState } from 'react';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Botão "Instalar o app no celular" (Painel). O app só pode ser instalado por quem
// está logado como admin, analista ou corretor — para o público o site não oferece.
export default function InstalarApp() {
  const [evento, setEvento] = useState<PromptEvent | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [ios, setIos] = useState(false);
  const [ajuda, setAjuda] = useState(false);

  useEffect(() => {
    // logou agora (sem recarregar a página): garante o manifesto e o service worker
    if (!document.querySelector('link[rel="manifest"]')) {
      const l = document.createElement('link');
      l.rel = 'manifest';
      l.href = '/manifest.webmanifest';
      document.head.appendChild(l);
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    setInstalado(window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as PromptEvent);
    };
    const onInstalled = () => setInstalado(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (instalado) {
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-[var(--border)] p-5">
        <span className="font-serif text-lg font-semibold">App instalado</span>
        <span className="text-sm text-[var(--text-muted)]">Você está usando o app Mais Novos Imóveis.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-accent/50 bg-[#f5f8ff] p-5">
      <span className="font-serif text-lg font-semibold">Instalar o app no celular</span>
      <span className="text-sm text-[var(--text-muted)]">Ícone na tela inicial, abre em tela cheia, direto no portal e no painel.</span>
      {evento ? (
        <button
          type="button"
          onClick={async () => {
            await evento.prompt();
            const r = await evento.userChoice;
            if (r.outcome === 'accepted') setInstalado(true);
            setEvento(null);
          }}
          className="self-start rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90"
        >
          Instalar agora
        </button>
      ) : (
        <button type="button" onClick={() => setAjuda(!ajuda)} className="self-start rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90">
          Como instalar
        </button>
      )}
      {ajuda && !evento && (
        <p className="text-sm leading-relaxed">
          {ios ? (
            <>
              No <strong>iPhone</strong>, abra este painel no <strong>Safari</strong>, toque em <strong>Compartilhar</strong> (quadrado com a seta) e depois em{' '}
              <strong>Adicionar à Tela de Início</strong>.
            </>
          ) : (
            <>
              No <strong>Android</strong>, abra no <strong>Chrome</strong>, toque nos <strong>três pontinhos</strong> e em <strong>Instalar app</strong> (ou{' '}
              <strong>Adicionar à tela inicial</strong>).
            </>
          )}
        </p>
      )}
    </div>
  );
}

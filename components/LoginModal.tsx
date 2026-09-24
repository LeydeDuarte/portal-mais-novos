'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loginComGoogle, type Cliente } from '@/lib/cliente-auth';

type Props = {
  open: boolean;
  onClose: () => void;
  onSignIn: (cliente?: Cliente | null) => void;
  titulo?: string;
  texto?: string;
};

type GoogleId = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; auto_select?: boolean }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function carregarGoogle(): Promise<GoogleId | null> {
  const w = window as unknown as { google?: GoogleId };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  return new Promise((resolve) => {
    const existente = document.getElementById('gsi-script') as HTMLScriptElement | null;
    const s = existente ?? document.createElement('script');
    s.onload = () => resolve((window as unknown as { google?: GoogleId }).google ?? null);
    s.onerror = () => resolve(null);
    if (!existente) {
      s.id = 'gsi-script';
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

export default function LoginModal({ open, onClose, onSignIn, titulo = 'Entre para salvar favoritos', texto }: Props) {
  const [termos, setTermos] = useState(false);
  const [marketing, setMarketing] = useState(false); // LGPD: consentimento de marketing nunca vem marcado
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const botaoRef = useRef<HTMLDivElement | null>(null);
  const prefs = useRef({ termos, marketing });
  prefs.current = { termos, marketing };

  useEffect(() => {
    if (!open || !CLIENT_ID) return;
    let vivo = true;
    carregarGoogle().then((g) => {
      if (!vivo || !g || !botaoRef.current) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          setErro(null);
          setEntrando(true);
          const r = await loginComGoogle(credential, prefs.current.termos, prefs.current.marketing).catch(() => ({ ok: false as const, erro: 'Falha ao entrar. Tente de novo.' }));
          setEntrando(false);
          if (r.ok) onSignIn(r.cliente);
          else setErro(r.erro);
        }
      });
      botaoRef.current.innerHTML = '';
      g.accounts.id.renderButton(botaoRef.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 296, locale: 'pt-BR' });
    });
    return () => {
      vivo = false;
    };
  }, [open, onSignIn]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-[380px] rounded-2xl bg-[var(--bg)] p-7 text-center shadow-2xl">
        <h3 className="font-serif text-xl">{titulo}</h3>
        <p className="mt-2 mb-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
          {texto ?? 'Sua conta guarda os imóveis salvos e personaliza o feed com o que você mais procura.'}
        </p>

        <label className="mb-2 flex items-start gap-2 text-left text-xs leading-snug text-[var(--text-muted)]">
          <input type="checkbox" className="mt-0.5" checked={termos} onChange={(e) => setTermos(e.target.checked)} />
          <span>
            Li e aceito os{' '}
            <Link href="/termos" target="_blank" className="font-semibold text-accent underline">
              Termos de uso e a Política de privacidade
            </Link>
            .
          </span>
        </label>
        <label className="mb-5 flex items-start gap-2 text-left text-xs leading-snug text-[var(--text-muted)]">
          <input type="checkbox" className="mt-0.5" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          <span>Quero receber oportunidades e novidades de imóveis por e-mail e WhatsApp (opcional).</span>
        </label>

        <div className="relative flex min-h-[44px] justify-center">
          {CLIENT_ID ? (
            <>
              <div ref={botaoRef} className={termos ? '' : 'pointer-events-none opacity-40'} />
              {!termos && (
                <button type="button" onClick={() => setErro('Marque o aceite dos Termos de uso para continuar.')} className="absolute inset-0" aria-label="Aceite os termos para continuar" />
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={!termos}
              onClick={() => onSignIn(null)}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[var(--border)] py-2.5 text-sm font-semibold hover:bg-[var(--pill-bg)] disabled:opacity-40"
              title="Login com Google ainda não configurado — modo de teste"
            >
              Continuar com Google (modo de teste)
            </button>
          )}
        </div>
        {entrando && <p className="mt-3 text-xs text-accent">Entrando…</p>}
        {erro && <p className="mt-3 text-xs font-semibold text-red-600">{erro}</p>}
        <button type="button" onClick={onClose} className="mt-4 text-xs text-[var(--text-faint)]">
          Agora não
        </button>
      </div>
    </div>
  );
}

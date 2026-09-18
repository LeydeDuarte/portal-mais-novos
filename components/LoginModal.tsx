'use client';

type Props = {
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
};

export default function LoginModal({ open, onClose, onSignIn }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5">
      <div className="w-full max-w-[360px] rounded-2xl bg-[var(--bg)] p-8 text-center shadow-2xl">
        <h3 className="font-serif text-xl">Entre para salvar favoritos</h3>
        <p className="mt-2 mb-6 text-[13px] leading-relaxed text-[var(--text-muted)]">
          Sua conta guarda os imóveis salvos e personaliza o feed com o que você mais procura.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--border)] py-2.5 text-sm font-semibold hover:bg-[var(--pill-bg)]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="9" fill="#4285F4" />
            <text x="9" y="12.5" textAnchor="middle" fontSize="10" fill="#fff" fontWeight={700}>
              G
            </text>
          </svg>
          Continuar com Google
        </button>
        <button type="button" onClick={onClose} className="mt-3.5 text-xs text-[var(--text-faint)]">
          Agora não
        </button>
      </div>
    </div>
  );
}

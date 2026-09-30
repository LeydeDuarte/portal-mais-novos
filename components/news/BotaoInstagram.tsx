// Botão do Direct do Instagram (no News, o contato é sempre por aqui, nunca WhatsApp direto)
import { INSTAGRAM_URL } from '@/lib/marca';

export default function BotaoInstagram({ rotulo = 'Conhecer a Leyde nas redes sociais', className = '', href = INSTAGRAM_URL }: { rotulo?: string; className?: string; href?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      data-rastro="instagram"
      className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] px-5 text-sm font-bold text-white hover:opacity-90 ${className}`}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
      </svg>
      {rotulo}
    </a>
  );
}

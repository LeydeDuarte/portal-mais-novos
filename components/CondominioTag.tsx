// Etiqueta do condomínio a que o anúncio está ligado — fica em destaque no card
// e na página do imóvel, mas com visual diferente do card de empreendimento
// (que é o condomínio em si), para não confundir.
export default function CondominioTag({ nome, grande = false }: { nome: string; grande?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md bg-[#EAF2FF] font-semibold text-[#14161A] ${
        grande ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-[11px] md:text-xs'
      }`}
      title={`Condomínio ${nome}`}
    >
      <svg width={grande ? 15 : 12} height={grande ? 15 : 12} viewBox="0 0 24 24" fill="none" stroke="#257CFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
        <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
        <path d="M16 9h2a2 2 0 0 1 2 2v10" />
        <path d="M3 21h18" />
        <path d="M8 7h4M8 11h4M8 15h4" />
      </svg>
      <span className="truncate">
        <span className="font-normal text-[var(--text-muted)]">Condomínio </span>
        {nome}
      </span>
    </span>
  );
}

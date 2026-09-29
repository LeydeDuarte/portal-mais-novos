// Selo "Aceita temporada": cor #FF385C com o ícone de sino de recepção.
// Nos cards aparece só o ícone (discreto); nas páginas, ícone + texto.
export function SinoRecepcao({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5.5V4" />
      <path d="M10.5 4h3" />
      <path d="M4 17a8 8 0 0 1 16 0" />
      <path d="M2.5 17h19" />
      <path d="M3.5 20h17" />
    </svg>
  );
}

export default function TemporadaBadge({ compacto = false, grande = false }: { compacto?: boolean; grande?: boolean }) {
  if (compacto) {
    return (
      <span
        title="Aceita temporada"
        aria-label="Aceita temporada"
        className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#FF385C] text-white shadow-sm"
      >
        <SinoRecepcao size={12} />
      </span>
    );
  }
  return (
    <span className={`flex items-center gap-1.5 rounded-md bg-[#FF385C] font-bold uppercase tracking-wide text-white ${grande ? 'px-3 py-1 text-xs' : 'px-2.5 py-1 text-[10px]'}`}>
      <SinoRecepcao size={grande ? 13 : 11} />
      Aceita temporada
    </span>
  );
}

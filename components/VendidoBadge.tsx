// Etiqueta "100% vendido" (marcada por analista/admin), no lugar das unidades disponíveis.
export default function VendidoBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-[#E62F2F] px-2.5 py-0.5 text-[11px] font-bold text-white ${className}`} title="Todas as unidades foram vendidas pela incorporadora">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m5 12 5 5L20 7" />
      </svg>
      100% vendido
    </span>
  );
}

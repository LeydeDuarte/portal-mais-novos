// Tag verde com a quantidade de anúncios ligados ao condomínio (card do feed)
export default function AnunciosBadge({ n, className = '' }: { n?: number; className?: string }) {
  if (!n || n < 1) return null;
  return (
    <span
      className={`pointer-events-none inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#16A34A] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm ${className}`}
      title={`${n} anúncio(s) neste condomínio`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
      <span className="font-sans tabular-nums">{n}</span> {n === 1 ? 'anúncio' : 'anúncios'}
    </span>
  );
}

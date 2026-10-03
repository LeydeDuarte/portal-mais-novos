// Etiqueta azul com as unidades disponíveis pela tabela de vendas mais recente
// (só lançamento, obras e pronto novo — quem decide é quem monta os dados do card).
export default function DisponiveisBadge({ n, className = '' }: { n?: number | null; className?: string }) {
  if (!n || n < 1) return null;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-[#E8F1FF] px-2.5 py-0.5 text-[11px] font-bold text-[#1B5FCC] ${className}`}
      title={`${n} unidade(s) disponível(is) pela tabela de vendas mais recente`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="3" width="16" height="18" rx="1.5" />
        <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
      </svg>
      <span className="font-sans tabular-nums">{n}</span> {n === 1 ? 'unidade disponível' : 'unidades disponíveis'}
    </span>
  );
}

// Etiqueta com as unidades disponíveis pela tabela de vendas mais recente
// (só lançamento, obras e pronto novo — quem decide é quem monta os dados do card).
// Menos de 10: vermelha, "Restam N unidades", com uma piscadinha suave (escassez).
export const LIMITE_ESCASSEZ = 10;

export default function DisponiveisBadge({ n, className = '' }: { n?: number | null; className?: string }) {
  if (!n || n < 1) return null;
  const poucas = n < LIMITE_ESCASSEZ;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
        poucas ? 'mn-escassez bg-[#FDECEC] text-[#C81E1E]' : 'bg-[#E8F1FF] text-[#1B5FCC]'
      } ${className}`}
      title={`${n} unidade(s) disponível(is) pela tabela de vendas mais recente`}
    >
      {poucas ? (
        <span className="h-1.5 w-1.5 rounded-full bg-[#E62F2F]" aria-hidden />
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
        </svg>
      )}
      {poucas ? (
        <>
          {n === 1 ? 'Resta' : 'Restam'} <span className="font-sans tabular-nums">{n}</span> {n === 1 ? 'unidade' : 'unidades'}
        </>
      ) : (
        <>
          <span className="font-sans tabular-nums">{n}</span> unidades disponíveis
        </>
      )}
    </span>
  );
}

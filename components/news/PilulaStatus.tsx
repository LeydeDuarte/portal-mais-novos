// Situação da notícia numa pílula colorida (bate o olho e já sabe): rascunho esperando
// revisão (amarelo), agendada aguardando a hora (azul), publicada no ar (verde).
export const CORES_STATUS = {
  rascunho: 'bg-[#FFF4D6] text-[#8A5A00] ring-[#F5DFA0]',
  agendada: 'bg-[#E8F1FF] text-[#1F5FCC] ring-[#C9DCFF]',
  publicada: 'bg-[#E7F9EE] text-[#0B6B33] ring-[#BFEBD0]'
} as const;

export default function PilulaStatus({ status, agendadoPara }: { status: 'rascunho' | 'agendada' | 'publicada'; agendadoPara: string | null }) {
  // agendada cuja hora já passou já está no ar
  const noAr = status === 'publicada' || (status === 'agendada' && !!agendadoPara && new Date(agendadoPara).getTime() <= Date.now());
  const tipo = noAr ? 'publicada' : status;
  const quando = agendadoPara
    ? new Date(agendadoPara).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '-';
  const texto = tipo === 'publicada' ? 'Publicada' : tipo === 'agendada' ? `Agendada · ${quando}` : 'Rascunho · revisar';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ${CORES_STATUS[tipo]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {texto}
    </span>
  );
}

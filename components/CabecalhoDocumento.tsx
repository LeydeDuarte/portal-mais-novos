// Cabeçalho padrão dos documentos em PDF para clientes (proposta, relatório de
// avaliação e os próximos): logo completa "maisnovosimoveis.com" no canto esquerdo,
// título e data à direita, linha fina embaixo. A logo do site continua a simples.
export default function CabecalhoDocumento({ rotulo, titulo, linha }: { rotulo?: string; titulo: string; linha?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-6 border-b border-[#e6e8eb] pb-5 print:pb-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/marca/logo-documentos.png" alt="Mais Novos Imóveis" className="h-11 w-auto shrink-0 print:h-9" />
      <div className="text-right">
        {rotulo && <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1B5FCC]">{rotulo}</div>}
        <div className="mt-1 font-serif text-[22px] font-semibold leading-tight">{titulo}</div>
        {linha && <div className="mt-0.5 text-[12px] text-[#5f6368]">{linha}</div>}
      </div>
    </header>
  );
}

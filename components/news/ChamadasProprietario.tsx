import Link from 'next/link';

// Duas chamadas pequenas para quem é dono de imóvel, na lateral das páginas do News
// (nunca no meio do texto): "Avalie seu imóvel" e "Venda seu imóvel".
// Os cliques contam em Painel → Resultados.
export default function ChamadasProprietario({ so }: { so?: 'avaliar' | 'vender' }) {
  return (
    <div className="flex flex-col gap-3">
      {so !== 'vender' && (
        <Link
          href="/avaliar"
          data-rastro="avaliar"
          className="group flex flex-col gap-1 rounded-2xl border-2 border-accent/30 bg-[#F3F7FF] p-4 hover:border-accent"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">Grátis e na hora</span>
          <span className="text-[17px] font-bold leading-snug">Quanto vale o seu imóvel hoje?</span>
          <span className="text-[12.5px] leading-snug text-[var(--text-muted)]">Comparamos com os anúncios da sua região, pelo método da NBR 14653.</span>
          <span className="mt-1 text-[13px] font-bold text-accent group-hover:underline">Avaliar meu imóvel →</span>
        </Link>
      )}
      {so !== 'avaliar' && (
        <Link
          href="/vender"
          data-rastro="vender"
          className="group flex flex-col gap-1 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 hover:border-[#14161A]"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Para proprietários</span>
          <span className="text-[17px] font-bold leading-snug">Quer vender o seu imóvel?</span>
          <span className="text-[12.5px] leading-snug text-[var(--text-muted)]">Anunciamos para quem já procura imóvel na sua região, com o preço certo.</span>
          <span className="mt-1 text-[13px] font-bold group-hover:underline">Venda com a gente →</span>
        </Link>
      )}
    </div>
  );
}

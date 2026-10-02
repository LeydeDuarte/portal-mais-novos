import Link from 'next/link';

// Chamada "Avalie seu imóvel" nas páginas de anúncio e de condomínio. O texto muda
// conforme a página: quem olha um lançamento muitas vezes tem um imóvel para dar de
// entrada; quem olha um anúncio muitas vezes precisa vender o seu para comprar.
// Clique conta em Resultados (data-rastro="avaliar").
export default function ChamadaAvaliar({ contexto, refId }: { contexto: 'imovel' | 'lancamento' | 'condominio'; refId?: string }) {
  const t =
    contexto === 'lancamento'
      ? { selo: 'Tem um imóvel para dar de entrada?', titulo: 'Descubra quanto vale o seu imóvel hoje', texto: 'Use o valor do seu imóvel atual na compra do lançamento. A avaliação é grátis e sai na hora.' }
      : contexto === 'imovel'
        ? { selo: 'Precisa vender para comprar?', titulo: 'Descubra quanto vale o seu imóvel hoje', texto: 'Saiba quanto o seu imóvel atual vale antes de negociar este. A avaliação é grátis e sai na hora.' }
        : { selo: 'Tem um imóvel na região?', titulo: 'Descubra quanto vale o seu imóvel hoje', texto: 'Compare com os anúncios e as vendas da região e saiba o preço que vende. Grátis e na hora.' };
  return (
    <Link
      href="/avaliar"
      data-rastro="avaliar"
      data-rastro-ref={refId}
      className="group mt-8 flex flex-col gap-4 rounded-[20px] border-2 border-accent/30 bg-[#F3F7FF] p-5 transition-colors hover:border-accent sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
            <path d="M9.5 15.5h5M12 13v5" />
          </svg>
        </span>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">{t.selo}</span>
          <h2 className="mt-0.5 text-[17px] font-bold leading-snug">{t.titulo}</h2>
          <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">{t.texto} Método comparativo da NBR 14653, com os anúncios da sua região.</p>
        </div>
      </div>
      <span className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-accent px-5 text-sm font-bold text-white group-hover:brightness-95">Avaliar meu imóvel →</span>
    </Link>
  );
}

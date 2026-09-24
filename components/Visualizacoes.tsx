// Foguinho com o número de visualizações (quantas vezes o anúncio foi aberto)
export function formatarVisualizacoes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 1000) return `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return String(n);
}

export default function Visualizacoes({ n, className = '' }: { n?: number; className?: string }) {
  if (!n || n < 1) return null;
  return (
    <span
      className={`pointer-events-none flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white backdrop-blur-sm ${className}`}
      title={`${n} visualizações`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#FF7A1A"
          d="M12 2c.6 3.2-1 5.2-2.6 7.1C7.8 11 6.5 12.7 6.5 15.2 6.5 18.9 9 22 12 22s5.5-2.9 5.5-6.6c0-2.3-1-4.2-2.2-5.6-.2 1.3-.8 2.4-1.8 3 .3-3.8-.6-8.1-1.5-10.8z"
        />
        <path fill="#FFD23F" d="M12 22c-1.8 0-3.2-1.6-3.2-3.6 0-1.7 1-2.8 2-3.9.4 1 1.1 1.6 1.9 1.9-.2-1.2.2-2.4.9-3.3 1 1.2 1.6 2.6 1.6 4.2 0 2.6-1.4 4.7-3.2 4.7z" />
      </svg>
      {formatarVisualizacoes(n)}
    </span>
  );
}

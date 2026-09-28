// Ícones das características do imóvel (feed e páginas): cama = quartos,
// chuveiro = banheiros, carro = vagas, setas nos cantos = metragem.
type P = { size?: number; className?: string };
const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true
});

export const IconeCama = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M3 19v-8.5A1.5 1.5 0 0 1 4.5 9H10a1 1 0 0 1 1 1v3h10v6" />
    <path d="M3 16h18" />
    <path d="M3 5v14" />
    <circle cx="6.5" cy="12" r="1.3" />
  </svg>
);

export const IconeChuveiro = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M5 21V6a3 3 0 0 1 6 0" />
    <path d="M8 6h6" />
    <path d="M9.5 10v.01M12 10v.01M14.5 10v.01M11 13v.01M13.5 13v.01M16 13v.01M12.5 16v.01M15 16v.01" strokeWidth={2.4} />
  </svg>
);

export const IconeCarro = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M5 17h14v-4.5l-1.8-4.3A1.5 1.5 0 0 0 15.8 7H8.2a1.5 1.5 0 0 0-1.4 1.2L5 12.5z" />
    <path d="M5 12.5h14" />
    <circle cx="8" cy="15" r="0.8" />
    <circle cx="16" cy="15" r="0.8" />
    <path d="M6.5 17v2M17.5 17v2" />
  </svg>
);

export const IconeMetragem = ({ size = 16, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M5 19 19 5" />
    <path d="M5 13v6h6" />
    <path d="M13 5h6v6" />
  </svg>
);

/** Ícone + número (sem a palavra), no tamanho do feed */
export function Caracteristica({ icone, valor, titulo }: { icone: React.ReactNode; valor: string | number | null | undefined; titulo: string }) {
  if (valor == null || valor === '' || valor === '-') return null;
  return (
    <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[var(--text)] md:text-[13px]" title={titulo}>
      <span className="text-[var(--text-muted)]">{icone}</span>
      <span className="tabular-nums">{valor}</span>
    </span>
  );
}

/** "3 qts" → 3 */
export const numeroDe = (s?: string | null) => {
  const n = parseInt(String(s ?? ''), 10);
  return Number.isFinite(n) ? n : null;
};

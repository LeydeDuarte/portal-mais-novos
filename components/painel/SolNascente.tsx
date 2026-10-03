// O sol nascendo: "Mais Novos" = um dia novo começando. É o único elemento
// "ousado" do painel e do login. Sobe uma vez ao abrir a tela (sem movimento
// para quem pediu menos animação no aparelho). Decorativo: aria-hidden.
export default function SolNascente({ className = '' }: { className?: string }) {
  const raios = Array.from({ length: 13 }, (_, i) => -90 + (i - 6) * 13.5);
  return (
    <svg viewBox="0 0 400 220" className={`pointer-events-none select-none ${className}`} aria-hidden>
      <defs>
        <clipPath id="mn-sol-horizonte">
          <rect x="0" y="0" width="400" height="200" />
        </clipPath>
      </defs>
      <g clipPath="url(#mn-sol-horizonte)">
        <g className="mn-sol-sobe">
          {raios.map((a) => {
            const r = (a * Math.PI) / 180;
            const x1 = 200 + Math.cos(r) * 112;
            const y1 = 200 + Math.sin(r) * 112;
            const x2 = 200 + Math.cos(r) * 150;
            const y2 = 200 + Math.sin(r) * 150;
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFC23D" strokeWidth="6" strokeLinecap="round" />;
          })}
          <circle cx="200" cy="200" r="92" fill="#FFC23D" />
        </g>
      </g>
      <line x1="40" y1="200" x2="360" y2="200" stroke="#257CFF" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

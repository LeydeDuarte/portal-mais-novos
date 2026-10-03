import type { FaseDoDia } from '@/lib/frases';

// Cena do céu que acompanha o horário de Brasília:
// manhã = sol nascendo (sobe ao abrir), tarde = sol alto, fim de tarde = sol laranja
// se pondo, noite = lua crescente com estrelas. Um movimento só, ao abrir a tela,
// e nenhum para quem pediu menos animação no aparelho. Decorativo: aria-hidden.
const AZUL = '#257CFF';

function Raios({ cx, cy, cor, de = 112, ate = 150, n = 13, abertura = 13.5, inicio = -90 }: { cx: number; cy: number; cor: string; de?: number; ate?: number; n?: number; abertura?: number; inicio?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = ((inicio + (i - (n - 1) / 2) * abertura) * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * de}
            y1={cy + Math.sin(a) * de}
            x2={cx + Math.cos(a) * ate}
            y2={cy + Math.sin(a) * ate}
            stroke={cor}
            strokeWidth="6"
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}

export default function SolNascente({ fase = 'manha', className = '' }: { fase?: FaseDoDia; className?: string }) {
  return (
    <svg viewBox="0 0 400 220" className={`pointer-events-none select-none ${className}`} aria-hidden>
      <defs>
        <clipPath id="mn-ceu-horizonte">
          <rect x="0" y="0" width="400" height="200" />
        </clipPath>
      </defs>

      {fase === 'manha' && (
        <g clipPath="url(#mn-ceu-horizonte)">
          <g className="mn-sol-sobe">
            <Raios cx={200} cy={200} cor="#FFC23D" />
            <circle cx="200" cy="200" r="92" fill="#FFC23D" />
          </g>
        </g>
      )}

      {fase === 'tarde' && (
        <g className="mn-ceu-aparece">
          {/* sol inteiro e alto, com raios em volta */}
          <Raios cx={200} cy={100} cor="#FFC23D" de={66} ate={92} n={16} abertura={22.5} inicio={0} />
          <circle cx="200" cy="100" r="52" fill="#FFC23D" />
        </g>
      )}

      {fase === 'entardecer' && (
        <g clipPath="url(#mn-ceu-horizonte)">
          <g className="mn-sol-desce">
            <Raios cx={200} cy={200} cor="#FF8A3D" de={108} ate={140} n={9} abertura={18} />
            <circle cx="200" cy="200" r="92" fill="#FF7A2F" />
          </g>
        </g>
      )}

      {fase === 'noite' && (
        <g className="mn-ceu-aparece">
          {/* estrelas */}
          {[
            [70, 46, 3], [118, 92, 2], [300, 40, 2.5], [342, 104, 3], [250, 70, 1.8], [96, 150, 2], [330, 162, 1.8], [160, 30, 2]
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.85} />
          ))}
          {/* lua crescente: um círculo claro "recortado" por outro da cor do céu */}
          <circle cx="210" cy="104" r="56" fill="#F4F6FF" />
          <circle cx="234" cy="88" r="50" fill="var(--ceu)" />
        </g>
      )}

      <line x1="40" y1="200" x2="360" y2="200" stroke={fase === 'noite' ? '#5B8CFF' : AZUL} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

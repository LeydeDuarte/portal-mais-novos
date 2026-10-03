import type { Icone } from '@/lib/painel-menu';

// Ícones de traço simples (24×24), desenhados para o painel.
const P: Record<Icone, JSX.Element> = {
  inicio: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></>,
  casa: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h5v-6h4v6h5V10" /></>,
  predio: <><rect x="5" y="3" width="10" height="18" rx="1" /><path d="M15 9h4v12h-4" /><path d="M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1" /><path d="M9 21v-3h2v3" /></>,
  mapa: <><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11Z" /><circle cx="12" cy="10" r="2.2" /></>,
  faisca: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6.5 6.5 2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" /></>,
  pdf: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></>,
  imagens: <><rect x="3" y="6" width="14" height="13" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v11" /><path d="m3 16 4-4 4 4 2-2 4 4" /></>,
  funil: <><path d="M3 5h18l-7 8v6l-4 2v-8Z" /></>,
  pessoa: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  proposta: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6M9 12h6" /></>,
  chave: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l2 2M14 9l2 2" /></>,
  sino: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  placa: <><path d="M5 21V4" /><path d="M5 5h13l-2 3 2 3H5" /></>,
  google: <><circle cx="12" cy="12" r="8" /><path d="M12 12h7" /><path d="M17.7 7A8 8 0 0 0 4 12" /></>,
  grafico: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="m7 15 4-4 3 3 5-6" /></>,
  radar: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 12 18 6" /></>,
  jornal: <><rect x="3" y="5" width="15" height="15" rx="1" /><path d="M18 9h3v9a2 2 0 0 1-2 2" /><path d="M6 9h9M6 13h9M6 17h6" /></>,
  estrela: <><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" /></>,
  guindaste: <><path d="M6 21V4h1l12 3" /><path d="M6 7h13M17 7v5" /><path d="M15 12h4v3h-4Z" /><path d="M3 21h8" /></>,
  trofeu: <><path d="M8 4h8v5a4 4 0 0 1-8 0Z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" /><path d="M12 13v4M8 21h8M10 17h4v4h-4Z" /></>,
  moedas: <><ellipse cx="9" cy="7" rx="5" ry="2.5" /><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7" /><path d="M10 15.5c.6 1.2 2.6 2 5 2 2.8 0 5-1.1 5-2.5v-4c0-1.4-2.2-2.5-5-2.5" /></>,
  equipe: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3 19a6 6 0 0 1 12 0M15 14.5a5 5 0 0 1 6 4.5" /></>,
  mudanca: <><rect x="3" y="8" width="12" height="9" rx="1" /><path d="M15 11h3l3 3v3h-6" /><circle cx="7" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" /></>,
  perfil: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5a6 6 0 0 1 11 0" /></>
};

export default function IconeFerramenta({ nome, size = 20 }: { nome: Icone; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[nome]}
    </svg>
  );
}

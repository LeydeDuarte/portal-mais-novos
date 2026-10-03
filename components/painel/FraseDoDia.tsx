import type { Frase } from '@/lib/frases';

// Frase do dia em letra grande (Poppins), com o autor embaixo.
export default function FraseDoDia({ frase, grande = false }: { frase: Frase; grande?: boolean }) {
  const longa = frase.texto.length > 110;
  const tam = grande
    ? longa
      ? 'text-[21px] md:text-[26px]'
      : 'text-[24px] md:text-[32px]'
    : longa
      ? 'text-[19px] md:text-[22px]'
      : 'text-[22px] md:text-[27px]';
  return (
    <figure className="max-w-[36ch]">
      <blockquote className={`font-serif font-medium leading-[1.28] tracking-[-0.01em] text-[var(--ceu-texto)] ${tam}`} suppressHydrationWarning>
        <span aria-hidden className="mr-0.5 text-accent">“</span>
        {frase.texto}
        <span aria-hidden className="ml-0.5 text-accent">”</span>
      </blockquote>
      <figcaption className="mt-3 text-[14px] text-[var(--text-muted)]" suppressHydrationWarning>
        <span className="font-semibold text-[var(--ceu-texto)]">{frase.autor}</span>
        {frase.obra && <>, em <i>{frase.obra}</i></>}
      </figcaption>
    </figure>
  );
}

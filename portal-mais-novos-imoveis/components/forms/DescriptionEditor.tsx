'use client';

import { useRef, useState } from 'react';
import RichText from '@/components/RichText';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
};

// Campo de descrição com botões simples (Subtítulo, Negrito, Itálico, Lista)
// e a prévia de como vai aparecer no site. O site aplica sempre o mesmo
// padrão visual — quem cadastra só marca o que é destaque.
export default function DescriptionEditor({ label, value, onChange, rows = 8, hint }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState(false);

  const envolver = (antes: string, depois: string, exemplo: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = value.slice(a, b) || exemplo;
    const novo = value.slice(0, a) + antes + sel + depois + value.slice(b);
    onChange(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + antes.length, a + antes.length + sel.length);
    });
  };

  const prefixarLinhas = (prefixo: string, exemplo: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const inicio = value.lastIndexOf('\n', a - 1) + 1;
    const trecho = value.slice(inicio, b) || exemplo;
    const convertido = trecho
      .split('\n')
      .map((l) => (l.trim() ? prefixo + l.replace(/^(#{1,3}\s+|[-•]\s+)/, '') : l))
      .join('\n');
    const antes = value.slice(0, inicio);
    const precisaQuebra = prefixo.startsWith('##') && antes && !antes.endsWith('\n\n') ? (antes.endsWith('\n') ? '\n' : '\n\n') : '';
    onChange(antes + precisaQuebra + convertido + value.slice(b));
    requestAnimationFrame(() => el.focus());
  };

  const btn = 'rounded-md px-2.5 py-1 text-xs font-semibold hover:bg-[var(--pill-bg-hover)]';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[var(--text-muted)]">{label}</label>
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--pill-bg)] px-2 py-1.5">
          <button type="button" className={btn} onClick={() => prefixarLinhas('## ', 'Subtítulo')} title="Subtítulo">
            Subtítulo
          </button>
          <button type="button" className={`${btn} font-bold`} onClick={() => envolver('**', '**', 'texto em negrito')} title="Negrito">
            B
          </button>
          <button type="button" className={`${btn} italic`} onClick={() => envolver('*', '*', 'texto em itálico')} title="Itálico">
            I
          </button>
          <button type="button" className={btn} onClick={() => prefixarLinhas('- ', 'item da lista')} title="Lista">
            • Lista
          </button>
          <span className="ml-auto" />
          <button type="button" className={`${btn} ${preview ? 'bg-ink text-white hover:bg-ink' : ''}`} onClick={() => setPreview((p) => !p)}>
            {preview ? 'Voltar a editar' : 'Ver como fica'}
          </button>
        </div>
        {preview ? (
          <div className="max-h-[420px] overflow-auto bg-[var(--bg)] p-4">
            {value.trim() ? <RichText texto={value} /> : <p className="text-sm text-[var(--text-faint)]">Nada escrito ainda.</p>}
          </div>
        ) : (
          <textarea
            ref={ref}
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full resize-y px-3 py-2.5 text-sm outline-none"
          />
        )}
      </div>
      <span className="text-xs text-[var(--text-faint)]">
        {hint ??
          'Deixe uma linha em branco entre os parágrafos. Linhas que começam com um rótulo (ex: "Lazer: piscina, academia") ganham destaque sozinhas. Textos longos aparecem recolhidos com "Ler descrição completa".'}
      </span>
    </div>
  );
}

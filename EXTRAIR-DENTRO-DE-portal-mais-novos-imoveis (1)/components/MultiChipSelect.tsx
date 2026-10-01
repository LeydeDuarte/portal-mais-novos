'use client';

type Props<T extends string> = {
  label: string;
  hint?: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
};

// Seletor de múltipla escolha em formato de botão — ex: quais tipos de imóvel
// existem num empreendimento, ou quais opções de quartos ele oferece.
export default function MultiChipSelect<T extends string>({ label, hint, options, value, onChange }: Props<T>) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[var(--text-muted)]">{label}</label>
      {hint && <span className="text-xs text-[var(--text-faint)]">{hint}</span>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                on ? 'border-ink bg-ink text-white' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--pill-bg)]'
              }`}
            >
              {on ? '✓ ' : ''}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

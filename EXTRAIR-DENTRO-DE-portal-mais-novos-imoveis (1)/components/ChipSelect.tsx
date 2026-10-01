'use client';

type Props = {
  label: string;
  options: string[]; // ex: ['1', '2', '3', '4', '5+']
  value: string;
  onChange: (value: string) => void;
};

// Seletor de escolha única em formato de botão — usado pra quartos, vagas e
// banheiros no cadastro, em vez de campo de texto livre.
export default function ChipSelect({ label, options, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[var(--text-muted)]">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              value === opt
                ? 'border-ink bg-ink text-white'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--pill-bg)]'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

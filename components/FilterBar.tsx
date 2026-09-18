const FILTERS = [
  'Finalidade',
  'Tipo de imóvel',
  'Faixa de preço',
  'Quartos',
  'Vagas de garagem',
  'Ano de entrega',
  'Idade do imóvel',
  'Aceita temporada'
];

export default function FilterBar() {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-[var(--border)] px-4 py-3.5 [scrollbar-width:none] md:gap-2.5 md:px-8 md:py-4 [&::-webkit-scrollbar]:hidden">
      {FILTERS.map((label) => (
        <button
          key={label}
          type="button"
          className="shrink-0 whitespace-nowrap rounded-full bg-[var(--pill-bg)] px-4 py-2.5 text-[13px] font-semibold hover:bg-[var(--pill-bg-hover)]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Foto (bolinha), nome e CRECI do corretor responsável pelo anúncio.
type C = { nome: string; foto: string | null; creci: string | null };

export default function CorretorSelo({ c, grande = false }: { c?: C | null; grande?: boolean }) {
  if (!c?.nome) return null;
  const tam = grande ? 'h-11 w-11 text-[15px]' : 'h-6 w-6 text-[10px]';
  return (
    <div className={`flex min-w-0 items-center ${grande ? 'gap-3' : 'gap-1.5'}`}>
      {c.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.foto} alt={`Foto de ${c.nome}`} loading="lazy" className={`${tam} shrink-0 rounded-full object-cover`} />
      ) : (
        <span className={`${tam} grid shrink-0 place-items-center rounded-full bg-accent/15 font-bold text-accent`}>{c.nome.slice(0, 1).toUpperCase()}</span>
      )}
      <span className={`min-w-0 leading-tight ${grande ? '' : 'text-[11px]'}`}>
        <span className={`block truncate font-semibold ${grande ? 'text-[15px]' : ''}`}>{c.nome}</span>
        {c.creci && <span className={`block truncate text-[var(--text-faint)] ${grande ? 'text-[12px]' : 'text-[10px]'}`}>CRECI {c.creci}</span>}
      </span>
    </div>
  );
}

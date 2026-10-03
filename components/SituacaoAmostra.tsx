// Etiqueta na frente da amostra: VENDIDO (verde) ou EXCLUÍDO (cinza), com a data.
export default function SituacaoAmostra({ situacao, em, pdf = false }: { situacao?: string | null; em?: string | null; pdf?: boolean }) {
  if (situacao !== 'vendido' && situacao !== 'excluido') return null;
  const vendido = situacao === 'vendido';
  const data = em ? em.slice(0, 10).split('-').reverse().join('/') : null;
  return (
    <span
      className={`mr-1 inline-block whitespace-nowrap rounded px-1.5 py-px align-middle font-bold uppercase tracking-wide ${pdf ? 'text-[8.5px] print:text-[7px]' : 'text-[10px]'} ${
        vendido ? 'bg-[#13874B] text-white' : 'bg-[#E4E6EA] text-[#3c4043]'
      }`}
      title={data ? `${vendido ? 'Vendido' : 'Excluído'} em ${data}` : undefined}
    >
      {vendido ? 'Vendido' : 'Excluído'}
      {data ? ` ${data}` : ''}
    </span>
  );
}

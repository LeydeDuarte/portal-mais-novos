// Situação discreta da amostra, embaixo da fonte: "vendido em dd/mm/aaaa" (verde) ou
// "excluído em dd/mm/aaaa" (cinza).
export default function SituacaoAmostra({ situacao, em, pdf = false }: { situacao?: string | null; em?: string | null; pdf?: boolean }) {
  if (situacao !== 'vendido' && situacao !== 'excluido') return null;
  const vendido = situacao === 'vendido';
  const data = em ? em.slice(0, 10).split('-').reverse().join('/') : null;
  return (
    <span className={`block ${pdf ? 'text-[9.5px] print:text-[7.5px]' : 'text-[11px]'} ${vendido ? 'font-semibold text-[#13874B]' : 'text-[#5f6368]'}`}>
      {vendido ? 'vendido' : 'excluído'}
      {data ? ` em ${data}` : ''}
    </span>
  );
}

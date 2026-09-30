'use client';

import { useMemo, useState } from 'react';

// Correção de um valor pelo índice escolhido (IPCA, INCC, IGP-M), do mês inicial até o
// último mês divulgado. A pessoa faz a conta sozinha, sem precisar de atendimento.
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotulo = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;

export default function CalculadoraIndice({ nome, historico }: { nome: string; historico: { data: string; valor: number }[] }) {
  const meses = historico.slice(-120);
  const [valor, setValor] = useState('');
  const [inicio, setInicio] = useState(meses.length > 12 ? meses[meses.length - 12].data : meses[0]?.data ?? '');
  const conta = useMemo(() => {
    const v = Number(valor.replace(/\./g, '').replace(',', '.'));
    const pontos = meses.filter((m) => m.data >= inicio);
    if (!(v > 0) || !pontos.length) return null;
    const fator = pontos.reduce((f, m) => f * (1 + m.valor / 100), 1);
    return { corrigido: v * fator, pct: (fator - 1) * 100, ate: pontos[pontos.length - 1].data, n: pontos.length };
  }, [valor, inicio, meses]);
  if (!meses.length) return null;
  const brl = (x: number) => x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="rounded-2xl bg-ink p-5 text-white">
      <h2 className="font-serif text-lg font-semibold">Quanto isso pesa no seu bolso?</h2>
      <p className="mt-1 text-sm text-[#C5CAD3]">Corrija uma parcela, um aluguel ou o valor de compra pelo {nome}.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#C5CAD3]">
          Valor (R$)
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="2.500" className="h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-[15px] text-white outline-none placeholder:text-white/40" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#C5CAD3]">
          A partir de
          <select value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-11 rounded-xl border border-white/20 bg-white/10 px-2 text-[15px] text-white outline-none">
            {[...meses].reverse().map((m) => (
              <option key={m.data} value={m.data} className="text-black">
                {rotulo(m.data)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {conta ? (
        <p className="mt-3 text-sm leading-relaxed">
          Corrigido até {rotulo(conta.ate)}: <strong className="text-[18px]">{brl(conta.corrigido)}</strong>
          <span className="block text-[#C5CAD3]">
            {conta.pct >= 0 ? '+' : ''}
            {conta.pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% em {conta.n} {conta.n === 1 ? 'mês' : 'meses'}
          </span>
        </p>
      ) : (
        <p className="mt-3 text-xs text-[#C5CAD3]">Digite o valor para ver a correção.</p>
      )}
    </div>
  );
}

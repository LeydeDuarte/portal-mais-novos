'use client';

import { useState } from 'react';
import { otimizarFotosDoFeed } from '@/lib/actions';

// Painel: gera as miniaturas leves das capas (o feed carrega bem mais rápido).
// Novas fotos já ganham miniatura sozinhas; isto é para as que já existiam.
export default function OtimizarFotos() {
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rodar = async () => {
    setRodando(true);
    let total = 0;
    try {
      for (let i = 0; i < 300; i++) {
        const r = await otimizarFotosDoFeed();
        total += r.feitas;
        setMsg(`${total} miniatura(s) prontas · faltam ${r.restantes}`);
        if (!r.restantes || (!r.feitas && r.erros.length)) break;
      }
      setMsg((m) => `${m ?? ''}. Pronto!`);
    } catch {
      setMsg('Parou no meio. Clique de novo para continuar.');
    }
    setRodando(false);
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-5">
      <span className="font-serif text-lg font-semibold">Otimizar fotos do feed</span>
      <span className="text-sm text-[var(--text-muted)]">Cria versões leves das capas para o feed abrir rápido no celular. As fotos novas já saem otimizadas.</span>
      <button type="button" onClick={rodar} disabled={rodando} className="self-start rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
        {rodando ? 'Otimizando…' : 'Otimizar agora'}
      </button>
      {msg && <span className="text-xs text-[var(--text-muted)]">{msg}</span>}
    </div>
  );
}

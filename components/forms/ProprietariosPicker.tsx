'use client';

import { useEffect, useState } from 'react';
import CepField, { ENDERECO_VAZIO } from '../CepField';
import { buscarProprietarios, salvarProprietario } from '@/lib/actions-proprietarios';
import type { Proprietario, ProprietarioDoImovel } from '@/lib/proprietarios';

const input = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-accent';
const tel = (d?: string | null) => {
  const n = (d ?? '').replace(/\D/g, '');
  return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}` : n;
};
export const linkWhats = (d?: string | null) => {
  const n = (d ?? '').replace(/\D/g, '');
  return n.length >= 10 ? `https://wa.me/${n.startsWith('55') ? n : `55${n}`}` : null;
};
const vazio: { tipo: 'pf' | 'pj'; nome: string; documento: string; whatsapp: string; email: string; observacao: string } = { tipo: 'pf', nome: '', documento: '', whatsapp: '', email: '', observacao: '' };

// Proprietários do imóvel: vários por imóvel, um principal. O cadastro fica no
// sistema e pode ser escolhido em outros imóveis e nas propostas. Nunca aparece no site.
export default function ProprietariosPicker({ value, onChange }: { value: ProprietarioDoImovel[]; onChange: (v: ProprietarioDoImovel[]) => void }) {
  const [q, setQ] = useState('');
  const [opcoes, setOpcoes] = useState<Proprietario[]>([]);
  const [novo, setNovo] = useState<typeof vazio | null>(null);
  const [end, setEnd] = useState(ENDERECO_VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) return setOpcoes([]);
    const tm = setTimeout(() => buscarProprietarios(q).then(setOpcoes).catch(() => {}), 250);
    return () => clearTimeout(tm);
  }, [q]);

  const adicionar = (p: Proprietario) => {
    if (!value.some((v) => v.id === p.id)) onChange([...value, { ...p, principal: value.length === 0 }]);
    setQ('');
    setOpcoes([]);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4">
      <div>
        <div className="text-sm font-bold">Proprietários</div>
        <p className="text-xs text-[var(--text-muted)]">Só a equipe vê. O principal aparece no card do painel, com o botão de WhatsApp.</p>
      </div>
      {value.map((p, i) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--pill-bg)] px-3 py-2 text-sm">
          <label className="flex items-center gap-1 text-xs font-semibold">
            <input type="radio" checked={p.principal} onChange={() => onChange(value.map((x, j) => ({ ...x, principal: j === i })))} /> principal
          </label>
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{p.nome}</span>
            <span className="block text-xs text-[var(--text-muted)]">{[p.tipo === 'pj' ? 'Empresa' : null, p.documento, tel(p.whatsapp), p.email].filter(Boolean).join(' · ')}</span>
          </span>
          {linkWhats(p.whatsapp) && (
            <a href={linkWhats(p.whatsapp)!} target="_blank" rel="noopener" className="rounded-full bg-[#16A34A] px-3 py-1 text-xs font-bold text-white">
              WhatsApp
            </a>
          )}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="px-1 text-lg leading-none text-[var(--text-muted)]" aria-label="Tirar">
            ×
          </button>
        </div>
      ))}
      {!novo && (
        <div className="relative">
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proprietário já cadastrado (nome, CPF/CNPJ ou telefone)" />
          {opcoes.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1 shadow-xl">
              {opcoes.map((o) => (
                <button key={o.id} type="button" onClick={() => adicionar(o)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--pill-bg)]">
                  <span className="font-semibold">{o.nome}</span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    {[o.documento, tel(o.whatsapp), o.imoveis ? `${o.imoveis} imóvel(is)` : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {novo ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-accent p-3">
          <div className="flex gap-2">
            {(['pf', 'pj'] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setNovo({ ...novo, tipo: tp })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${novo.tipo === tp ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}
              >
                {tp === 'pf' ? 'Pessoa física' : 'Empresa'}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={`${input} sm:col-span-2`} placeholder="Nome completo / razão social *" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            <input className={input} placeholder={novo.tipo === 'pj' ? 'CNPJ' : 'CPF'} inputMode="numeric" value={novo.documento} onChange={(e) => setNovo({ ...novo, documento: e.target.value })} />
            <input className={input} placeholder="WhatsApp com DDD" inputMode="tel" value={novo.whatsapp} onChange={(e) => setNovo({ ...novo, whatsapp: e.target.value })} />
            <input className={`${input} sm:col-span-2`} placeholder="E-mail" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
          </div>
          <CepField modo="pessoa" value={end} onChange={setEnd} />
          <textarea className={input} placeholder="Observação (só equipe)" value={novo.observacao} onChange={(e) => setNovo({ ...novo, observacao: e.target.value })} />
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                setErro(null);
                const r = await salvarProprietario({
                  ...novo,
                  cep: end.cep,
                  endereco: end.logradouro,
                  bairro: end.bairro,
                  cidade: end.cidade,
                  uf: end.uf,
                  empresaId: null
                }).catch(() => null);
                if (!r?.ok) return setErro(r?.erro ?? 'Não foi possível salvar.');
                adicionar(r.proprietario);
                setNovo(null);
                setEnd(ENDERECO_VAZIO);
              }}
              className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-white"
            >
              Salvar proprietário
            </button>
            <button type="button" onClick={() => setNovo(null)} className="rounded-full px-3 py-2 text-xs font-semibold hover:bg-[var(--pill-bg)]">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setNovo({ ...vazio })} className="w-fit rounded-full border border-dashed border-accent px-4 py-2 text-xs font-bold text-accent">
          + Novo proprietário
        </button>
      )}
    </div>
  );
}

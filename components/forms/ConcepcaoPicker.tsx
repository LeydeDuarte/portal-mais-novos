'use client';

import { useEffect, useState } from 'react';
import { buscarEmpresas, cadastrarPorCnpj, cadastrarPorNome, definirCnpj } from '@/lib/actions-empresas';
import { PAPEL_LABEL, empresaAtiva, formatarCnpj, nomeEmpresa, textoSituacao, type ConcepcaoItem, type Empresa, type PapelEmpresa } from '@/lib/empresas-tipos';

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-accent';

// Campo "Concepção": uma ou várias construtoras/incorporadoras (igual à escolha de
// bairros). Busca pelo nome ou CNPJ; CNPJ que ainda não existe é consultado na
// Receita e a empresa já fica cadastrada.
export default function ConcepcaoPicker({ value, onChange, obrigatorio }: { value: ConcepcaoItem[]; onChange: (v: ConcepcaoItem[]) => void; obrigatorio?: boolean }) {
  const [q, setQ] = useState('');
  const [opcoes, setOpcoes] = useState<Empresa[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [cnpjDe, setCnpjDe] = useState<Record<string, string>>({});
  const digitos = q.replace(/\D/g, '');
  const ehCnpj = digitos.length === 14;

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return setOpcoes([]);
    const tm = setTimeout(() => buscarEmpresas(t).then(setOpcoes).catch(() => {}), 250);
    return () => clearTimeout(tm);
  }, [q]);

  const adicionar = (e: Empresa) => {
    if (!value.some((v) => v.empresa.id === e.id)) onChange([...value, { empresa: e, papel: 'construtora_incorporadora' }]);
    setQ('');
    setOpcoes([]);
    setMsg(null);
  };

  const consultar = async () => {
    setConsultando(true);
    setMsg('Consultando a Receita Federal…');
    try {
      const r = await cadastrarPorCnpj(digitos);
      if (!r.ok) return setMsg(r.erro);
      adicionar(r.empresa);
      setMsg(r.nova ? `${nomeEmpresa(r.empresa)} cadastrada pela Receita.` : null);
    } catch {
      setMsg('Não foi possível consultar agora. Tente de novo.');
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-4">
      <div>
        <div className="text-sm font-bold">
          Concepção {obrigatorio && <span className="text-red-600">*</span>}
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Construtoras e incorporadoras que fizeram o empreendimento. Aparece no site e no perfil de cada empresa.
          {obrigatorio ? ' Obrigatório nesta fase (breve lançamento até seminovo).' : ''}
        </p>
      </div>
      {value.map((v, i) => (
        <div key={v.empresa.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--pill-bg)] px-3 py-2">
          <span className={`min-w-0 flex-1 text-sm font-semibold ${empresaAtiva(v.empresa) ? '' : 'text-[var(--text-faint)]'}`}>
            {nomeEmpresa(v.empresa)}
            <span className="block text-[11px] font-normal text-[var(--text-muted)]">
              {v.empresa.cnpj ? `CNPJ ${formatarCnpj(v.empresa.cnpj)} · ${textoSituacao(v.empresa) ?? 'situação não informada'}` : 'Sem CNPJ: complete em Painel → Construtoras'}
            </span>
          </span>
          <select
            value={v.papel}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, papel: e.target.value as PapelEmpresa } : x)))}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs"
          >
            {Object.entries(PAPEL_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="px-1 text-lg leading-none text-[var(--text-muted)]" aria-label="Tirar">
            ×
          </button>
          {!v.empresa.cnpj && (
            <div className="flex w-full gap-2">
              <input
                className={`${inputClass} py-1.5`}
                inputMode="numeric"
                placeholder="Informe o CNPJ desta empresa"
                value={cnpjDe[v.empresa.id] ?? ''}
                onChange={(e) => setCnpjDe({ ...cnpjDe, [v.empresa.id]: e.target.value })}
              />
              <button
                type="button"
                onClick={async () => {
                  setMsg('Consultando a Receita Federal…');
                  const r = await definirCnpj(v.empresa.id, cnpjDe[v.empresa.id] ?? '').catch(() => null);
                  if (!r?.ok) return setMsg(r?.erro ?? 'Não foi possível consultar agora.');
                  onChange(value.map((x, j) => (j === i ? { ...x, empresa: r.empresa } : x)));
                  setMsg(r.juntou ? `Esse CNPJ já era de ${r.empresa.nomeFantasia ?? r.empresa.razaoSocial}: cadastros juntados.` : 'CNPJ gravado com os dados da Receita.');
                }}
                className="shrink-0 rounded-lg bg-accent px-3 text-xs font-bold text-white"
              >
                Gravar CNPJ
              </button>
            </div>
          )}
        </div>
      ))}
      <div className="relative">
        <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite o nome da empresa ou o CNPJ" />
        {q.trim().length >= 2 && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1 shadow-xl">
            {opcoes.map((e) => (
              <button key={e.id} type="button" onClick={() => adicionar(e)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--pill-bg)]">
                <span className={`font-semibold ${empresaAtiva(e) ? '' : 'text-[var(--text-faint)]'}`}>{nomeEmpresa(e)}</span>
                <span className="block text-xs text-[var(--text-muted)]">
                  {e.cnpj ? `${formatarCnpj(e.cnpj)} · ${textoSituacao(e) ?? ''}` : 'sem CNPJ'}
                  {e.totalEmpreendimentos ? ` · ${e.totalEmpreendimentos} empreendimento(s)` : ''}
                </span>
              </button>
            ))}
            {!ehCnpj && q.trim().length >= 2 && (
              <button
                type="button"
                onClick={async () => {
                  const r = await cadastrarPorNome(q).catch(() => null);
                  if (r?.ok) {
                    adicionar(r.empresa);
                    setMsg(r.empresa.cnpj ? null : `${r.empresa.nomeFantasia ?? r.empresa.razaoSocial} cadastrada sem CNPJ. Complete o CNPJ depois em Painel → Construtoras.`);
                  } else setMsg(r?.erro ?? 'Não foi possível cadastrar.');
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-accent hover:bg-[var(--pill-bg)]"
              >
                + Cadastrar &quot;{q.trim()}&quot; só com o nome (CNPJ depois)
              </button>
            )}
            {ehCnpj && !opcoes.some((o) => o.cnpj === digitos) && (
              <button type="button" disabled={consultando} onClick={consultar} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-accent hover:bg-[var(--pill-bg)]">
                {consultando ? 'Consultando…' : `Buscar o CNPJ ${formatarCnpj(digitos)} na Receita e cadastrar`}
              </button>
            )}
          </div>
        )}
      </div>
      {msg && <p className="text-xs font-semibold text-accent">{msg}</p>}
      {!ehCnpj && q.trim().length >= 2 && opcoes.length === 0 && (
        <p className="text-xs text-[var(--text-muted)]">Nenhuma empresa com esse nome. Cadastre só pelo nome ou digite o CNPJ (14 números) para buscar na Receita.</p>
      )}
    </div>
  );
}

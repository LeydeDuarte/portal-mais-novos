'use client';

import { useEffect, useState } from 'react';
import {
  buscarCondominiosParaVincular,
  desvincularEmpreendimento,
  empreendimentosDaEmpresaPainel,
  vincularEmpreendimentos,
  type CondoVinculo
} from '@/lib/actions-empresas';
import { PAPEL_LABEL, type PapelEmpresa } from '@/lib/empresas-tipos';

const campo = 'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-ink';

// No cadastro da empresa: ver os empreendimentos ligados e buscar outros para
// vincular, filtrando por UF, cidade, bairro e nome (marca vários de uma vez).
export default function EmpresaEmpreendimentos({ empresaId }: { empresaId: string }) {
  const [ligados, setLigados] = useState<CondoVinculo[]>([]);
  const [f, setF] = useState({ nome: '', uf: '', cidade: '', bairro: '' });
  const [res, setRes] = useState<{ lista: CondoVinculo[]; ufs: string[]; cidades: string[]; bairros: string[] }>({ lista: [], ufs: [], cidades: [], bairros: [] });
  const [marcados, setMarcados] = useState<string[]>([]);
  const [papel, setPapel] = useState<PapelEmpresa>('construtora_incorporadora');
  const carregar = () => empreendimentosDaEmpresaPainel(empresaId).then(setLigados).catch(() => {});
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);
  useEffect(() => {
    const t = setTimeout(() => buscarCondominiosParaVincular(empresaId, f).then(setRes).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [empresaId, f]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-4">
      <div className="text-sm font-bold">Empreendimentos desta empresa ({ligados.length})</div>
      {ligados.length > 0 && (
        <div className="flex max-h-48 flex-col gap-1 overflow-auto">
          {ligados.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg bg-[var(--pill-bg)] px-3 py-1.5 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate">
                <strong>{c.nome}</strong> · {[c.bairro, c.cidade, c.uf].filter(Boolean).join(', ')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">{PAPEL_LABEL[c.papel as PapelEmpresa] ?? c.papel}</span>
              <button
                type="button"
                onClick={async () => {
                  await desvincularEmpreendimento(empresaId, c.id);
                  carregar();
                  setF({ ...f });
                }}
                className="px-1 text-base text-[var(--text-muted)]"
                aria-label="Desvincular"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-1 text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Vincular empreendimentos</div>
      <div className="grid gap-2 sm:grid-cols-4">
        <select className={campo} value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value, cidade: '', bairro: '' })}>
          <option value="">UF</option>
          {res.ufs.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select className={campo} value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value, bairro: '' })}>
          <option value="">Cidade</option>
          {res.cidades.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className={campo} value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })} disabled={!f.cidade}>
          <option value="">Bairro</option>
          {res.bairros.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <input className={campo} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Nome do condomínio" />
      </div>
      <div className="max-h-64 overflow-auto rounded-xl border border-[var(--border)]">
        {res.lista.map((c) => (
          <label key={c.id} className={`flex cursor-pointer items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-[12.5px] last:border-0 ${c.vinculado ? 'opacity-50' : 'hover:bg-[var(--pill-bg)]'}`}>
            <input
              type="checkbox"
              disabled={c.vinculado}
              checked={c.vinculado || marcados.includes(c.id)}
              onChange={() => setMarcados((m) => (m.includes(c.id) ? m.filter((x) => x !== c.id) : [...m, c.id]))}
            />
            <span className="min-w-0 flex-1 truncate">
              <strong>{c.nome}</strong> · {[c.bairro, c.cidade, c.uf].filter(Boolean).join(', ')}
            </span>
            {c.vinculado && <span className="text-[11px]">já vinculado</span>}
          </label>
        ))}
        {res.lista.length === 0 && <p className="p-3 text-[12.5px] text-[var(--text-muted)]">Nenhum condomínio com esses filtros.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${campo} w-auto`} value={papel} onChange={(e) => setPapel(e.target.value as PapelEmpresa)}>
          {Object.entries(PAPEL_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!marcados.length}
          onClick={async () => {
            await vincularEmpreendimentos(empresaId, marcados, papel);
            setMarcados([]);
            carregar();
            setF({ ...f });
          }}
          className="h-10 rounded-full bg-ink px-5 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          Vincular {marcados.length || ''} selecionado(s)
        </button>
      </div>
    </div>
  );
}

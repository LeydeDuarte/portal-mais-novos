'use client';

import { useEffect, useState } from 'react';
import { buscarProfissionais, consultarCnpjParaProposta, type ProfissionalConhecido } from '@/lib/actions-propostas';
import type { Intermediario } from '@/lib/proposta-textos';
import { input, label } from './PessoaCampos';

// Intermediação da proposta: imobiliárias (CNPJ) e corretores (CRECI), responsáveis ou
// parceiros. Só UM assina. A parte de cada um nos honorários é opcional.
const mascaraCnpj = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
};

function Linha({
  item,
  podeTirar,
  mostrarParte,
  onChange,
  onTirar,
  onAssinar
}: {
  item: Intermediario;
  podeTirar: boolean;
  mostrarParte: boolean;
  onChange: (i: Intermediario) => void;
  onTirar: () => void;
  onAssinar: () => void;
}) {
  const [sugestoes, setSugestoes] = useState<ProfissionalConhecido[]>([]);
  const [busca, setBusca] = useState('');
  useEffect(() => {
    const q = busca.trim();
    if (q.length < 2) return setSugestoes([]);
    const tm = setTimeout(() => buscarProfissionais(q).then((l) => setSugestoes(l.filter((x) => x.tipo === item.tipo))).catch(() => {}), 250);
    return () => clearTimeout(tm);
  }, [busca, item.tipo]);
  // imobiliária: o CNPJ completo puxa a razão social (dados públicos)
  const conferirCnpj = async (doc: string) => {
    const dig = doc.replace(/\D/g, '');
    if (dig.length !== 14 || item.nome) return;
    const p = await consultarCnpjParaProposta(doc).catch(() => null);
    if (p) onChange({ ...item, documento: doc, nome: p.nome });
  };
  const imob = item.tipo === 'imobiliaria';
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{imob ? 'Imobiliária' : 'Corretor(a)'}</span>
        <select className="h-8 rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 text-[12.5px] font-semibold" value={item.papel} onChange={(e) => onChange({ ...item, papel: e.target.value as Intermediario['papel'] })}>
          <option value="responsavel">Responsável</option>
          <option value="parceiro">{imob ? 'Parceira' : 'Parceiro(a)'}</option>
        </select>
        <label className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold ${item.assina ? 'bg-accent text-white' : 'bg-[var(--pill-bg)]'}`}>
          <input type="radio" name="assina-intermediacao" className="sr-only" checked={item.assina} onChange={onAssinar} />
          {item.assina ? 'Assina a proposta' : 'Marcar para assinar'}
        </label>
        {podeTirar && (
          <button type="button" onClick={onTirar} className="ml-auto text-xs font-semibold text-red-600">
            Tirar
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {imob && (
          <div>
            <span className={label}>CNPJ</span>
            <input
              className={input}
              inputMode="numeric"
              value={item.documento ?? ''}
              onChange={(e) => {
                const v = mascaraCnpj(e.target.value);
                onChange({ ...item, documento: v });
                if (v.replace(/\D/g, '').length === 14) conferirCnpj(v);
              }}
            />
          </div>
        )}
        <div className="relative">
          <span className={label}>{imob ? 'Razão social ou nome' : 'Nome (ou busque pelo CRECI)'}</span>
          <input
            className={input}
            value={item.nome}
            onChange={(e) => {
              onChange({ ...item, nome: e.target.value });
              setBusca(e.target.value);
            }}
            onBlur={() => setTimeout(() => setSugestoes([]), 200)}
          />
          {sugestoes.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-lg">
              {sugestoes.map((s) => (
                <button
                  key={`${s.nome}-${s.creci ?? ''}`}
                  type="button"
                  onMouseDown={() => {
                    onChange({ ...item, nome: s.nome, creci: s.creci ?? item.creci, documento: s.documento ?? item.documento });
                    setSugestoes([]);
                    setBusca('');
                  }}
                  className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--pill-bg)]"
                >
                  <b>{s.nome}</b>
                  {s.creci && <span className="text-[var(--text-muted)]"> · CRECI {s.creci.replace(/^creci\s*/i, '')}</span>}
                  <span className="block text-[11px] text-[var(--text-muted)]">{s.origem}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className={label}>CRECI</span>
          <input
            className={input}
            value={item.creci ?? ''}
            onChange={(e) => {
              onChange({ ...item, creci: e.target.value });
              if (!imob) setBusca(e.target.value);
            }}
            placeholder={imob ? 'Ex.: CJ 38746' : 'Ex.: CF 17586'}
          />
        </div>
        {mostrarParte && (
          <div>
            <span className={label}>Parte nos honorários (%)</span>
            <input
              className={input}
              inputMode="decimal"
              value={item.partePct ?? ''}
              onChange={(e) => {
                const v = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
                onChange({ ...item, partePct: v === '' ? null : (v as unknown as number) });
              }}
              placeholder="Opcional"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntermediacaoCampos({ lista, onChange, comHonorarios }: { lista: Intermediario[]; onChange: (l: Intermediario[]) => void; comHonorarios: boolean }) {
  const mudar = (i: number, item: Intermediario) => onChange(lista.map((x, j) => (j === i ? item : x)));
  const acrescentar = (tipo: Intermediario['tipo']) => onChange([...lista, { tipo, nome: '', papel: 'parceiro', assina: lista.length === 0 }]);
  return (
    <div className="flex flex-col gap-3">
      {lista.map((item, i) => (
        <Linha
          key={i}
          item={item}
          podeTirar={lista.length > 1}
          mostrarParte={comHonorarios}
          onChange={(it) => mudar(i, it)}
          onTirar={() => {
            const resto = lista.filter((_, j) => j !== i);
            if (item.assina && resto.length) resto[0] = { ...resto[0], assina: true };
            onChange(resto);
          }}
          onAssinar={() => onChange(lista.map((x, j) => ({ ...x, assina: j === i })))}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => acrescentar('corretor')} className="w-fit rounded-full border border-dashed border-accent px-4 py-2 text-sm font-bold text-accent">
          + Acrescentar corretor(a)
        </button>
        <button type="button" onClick={() => acrescentar('imobiliaria')} className="w-fit rounded-full border border-dashed border-accent px-4 py-2 text-sm font-bold text-accent">
          + Acrescentar imobiliária
        </button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">Todos aparecem na proposta; só quem estiver marcado assina.</p>
    </div>
  );
}

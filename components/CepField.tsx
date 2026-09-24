'use client';

import { useEffect, useRef, useState } from 'react';
import { findCondominiosByCep, type CondominioSugestao } from '@/lib/actions';

export type Endereco = {
  cep: string; // só dígitos
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export const ENDERECO_VAZIO: Endereco = { cep: '', logradouro: '', bairro: '', cidade: '', uf: '' };

// "Setor Bueno, Goiânia — GO" — é o texto público do anúncio (rua e número
// ficam guardados só para a equipe, não aparecem para o cliente).
export function formatLocation(e: Endereco): string {
  const cidadeUf = [e.cidade, e.uf].filter(Boolean).join(' — ');
  return [e.bairro, cidadeUf].filter(Boolean).join(', ');
}

function maskCep(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

async function buscarCep(cep: string): Promise<Omit<Endereco, 'cep'> | null> {
  // ViaCEP primeiro; se estiver fora do ar, tenta a BrasilAPI
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (res.ok && !data.erro) {
      return { logradouro: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', uf: data.uf || '' };
    }
  } catch {
    // segue para a alternativa
  }
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { logradouro: data.street || '', bairro: data.neighborhood || '', cidade: data.city || '', uf: data.state || '' };
  } catch {
    return null;
  }
}

type Props = {
  value: Endereco;
  onChange: (next: Endereco) => void;
  // Chamado quando a pessoa escolhe um condomínio já cadastrado com o mesmo CEP
  onPickCondominio?: (s: CondominioSugestao) => void;
  // No cadastro de empreendimento: só avisa que já existe, pra não duplicar
  modo?: 'imovel' | 'empreendimento';
};

const inputClass = 'w-full min-w-0 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none';

export default function CepField({ value, onChange, onPickCondominio, modo = 'imovel' }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'notfound'>('idle');
  const [sugestoes, setSugestoes] = useState<CondominioSugestao[]>([]);
  const lastLookup = useRef('');
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const cep = value.cep;
    if (cep.length !== 8 || cep === lastLookup.current) return;
    lastLookup.current = cep;
    setStatus('loading');
    setSugestoes([]);
    (async () => {
      const [endereco, condos] = await Promise.all([buscarCep(cep), findCondominiosByCep(cep).catch(() => [])]);
      if (endereco) {
        onChange({ ...valueRef.current, ...endereco, cep });
        setStatus('ok');
      } else {
        setStatus('notfound');
      }
      setSugestoes(condos);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.cep]);

  const set = <K extends keyof Endereco>(key: K, v: Endereco[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4">
      <div className="grid grid-cols-[140px_1fr] items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">CEP</label>
          <input
            inputMode="numeric"
            className={inputClass}
            value={maskCep(value.cep)}
            onChange={(e) => set('cep', e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="74000-000"
          />
        </div>
        <span className="pb-2.5 text-xs text-[var(--text-faint)]">
          {status === 'loading' && 'Buscando endereço…'}
          {status === 'ok' && 'Endereço encontrado — confira abaixo.'}
          {status === 'notfound' && 'CEP não encontrado — preencha o endereço à mão.'}
          {status === 'idle' && 'Digite o CEP e o endereço é preenchido sozinho.'}
        </span>
      </div>

      {sugestoes.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-[var(--pill-bg)] p-3">
          <span className="text-xs font-bold">
            {modo === 'empreendimento'
              ? 'Atenção: já existe cadastro neste CEP — confira se não é o mesmo empreendimento:'
              : 'Encontramos condomínio(s) já cadastrado(s) neste CEP:'}
          </span>
          {sugestoes.map((s) => (
            <div key={`${s.kind}-${s.id ?? s.nome}`} className="flex items-center justify-between gap-3 text-sm">
              <span>
                <strong>{s.nome}</strong>
                <span className="text-[var(--text-muted)]"> — {s.kind === 'empreendimento' ? 'empreendimento cadastrado' : 'condomínio de imóvel já anunciado'}</span>
              </span>
              {modo === 'imovel' && onPickCondominio && (
                <button
                  type="button"
                  onClick={() => onPickCondominio(s)}
                  className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                >
                  É este
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Rua / logradouro (fica só para a equipe, não aparece no anúncio)</label>
        <input className={inputClass} value={value.logradouro} onChange={(e) => set('logradouro', e.target.value)} placeholder="Rua T-55" />
      </div>
      <div className="grid grid-cols-[1fr_1fr_70px] gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Bairro</label>
          <input required className={inputClass} value={value.bairro} onChange={(e) => set('bairro', e.target.value)} placeholder="Setor Bueno" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Cidade</label>
          <input required className={inputClass} value={value.cidade} onChange={(e) => set('cidade', e.target.value)} placeholder="Goiânia" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">UF</label>
          <input
            required
            maxLength={2}
            className={inputClass}
            value={value.uf}
            onChange={(e) => set('uf', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            placeholder="GO"
          />
        </div>
      </div>
    </div>
  );
}

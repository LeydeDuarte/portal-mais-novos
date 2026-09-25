'use client';

import { useRef, useState } from 'react';
import CepField, { type Endereco } from '../CepField';
import { textoDoArquivo, lerIdentidade, lerComprovante, formatarCpf } from '@/lib/leitura-documentos';
import { ESTADO_CIVIL } from '@/lib/proposta-textos';
import type { Pessoa } from '@/lib/actions-propostas';

export const input = 'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-accent';
export const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]';

const mascaraTel = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};
function mascaraDoc(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) return formatarCpf(d);
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
}

export type PessoaForm = Pessoa & { numero?: string };

// Campos de uma pessoa (comprador ou vendedor) + leitura automática de documento.
// Os arquivos escolhidos são lidos SÓ no navegador para preencher os campos: não
// são enviados nem guardados em lugar nenhum.
export default function PessoaCampos({ valor, onChange, empresa = false }: { valor: PessoaForm; onChange: (p: PessoaForm) => void; empresa?: boolean }) {
  const ref = useRef(valor);
  ref.current = valor;
  const set = (m: Partial<PessoaForm>) => onChange({ ...ref.current, ...m });
  const [lendo, setLendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const pj = empresa || (valor.documento ?? '').replace(/\D/g, '').length > 11;

  const ler = async (tipo: 'identidade' | 'endereco', f?: File) => {
    if (!f) return;
    setLendo(tipo === 'identidade' ? 'Lendo o documento…' : 'Lendo o comprovante…');
    setAviso(null);
    try {
      const texto = await textoDoArquivo(f);
      const atual = ref.current;
      const m: Partial<PessoaForm> = {};
      const achou: string[] = [];
      if (tipo === 'identidade') {
        const d = lerIdentidade(texto);
        if (d.nome && !atual.nome) (m.nome = d.nome), achou.push('nome');
        if (d.cpf && !atual.documento) (m.documento = d.cpf), achou.push('CPF');
        if (d.rg && !atual.rg) (m.rg = d.rg), achou.push('RG');
        if (d.nascimento && !atual.nascimento) (m.nascimento = d.nascimento), achou.push('nascimento');
      } else {
        const e = lerComprovante(texto);
        if (e.cep && !atual.cep) (m.cep = e.cep), achou.push('CEP');
        const n = e.endereco?.match(/(?:n[ºo°.]?\s*|,\s*)(\d{1,6}[A-Za-z]?)\b/i)?.[1] ?? e.endereco?.match(/\b(q[d.]?\s*\S+.{0,4}l[t.]?\s*\S+)/i)?.[1];
        if (n && !atual.numero) (m.numero = n), achou.push('número');
      }
      set(m);
      setAviso(achou.length ? `Preenchido: ${achou.join(', ')}. Confira.` : 'Não deu para ler automaticamente. Preencha à mão.');
    } catch {
      setAviso('Não deu para ler automaticamente. Preencha à mão.');
    } finally {
      setLendo(null);
    }
  };

  const end: Endereco = { cep: valor.cep ?? '', logradouro: valor.endereco ?? '', bairro: valor.bairro ?? '', cidade: valor.cidade ?? '', uf: valor.uf ?? '' };

  return (
    <div className="flex flex-col gap-4">
      {!empresa && (
        <div className="rounded-xl bg-[var(--pill-bg)] p-3.5">
          <div className="text-sm font-bold">Preencher pelos documentos</div>
          <p className="text-xs text-[var(--text-muted)]">Foto ou PDF. O arquivo é só lido aqui no seu aparelho: não é enviado nem guardado.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ['identidade', 'RG / CNH'],
                ['endereco', 'Comprovante de endereço']
              ] as const
            ).map(([tipo, rot]) => (
              <label key={tipo} className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs font-bold hover:border-accent">
                {rot}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    ler(tipo, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            ))}
          </div>
          {(lendo || aviso) && <p className="mt-2 text-xs font-semibold text-accent">{lendo ?? aviso}</p>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className={label}>{pj ? 'Razão social / nome *' : 'Nome completo *'}</span>
          <input className={input} value={valor.nome} onChange={(e) => set({ nome: e.target.value })} maxLength={160} />
        </div>
        <div>
          <span className={label}>{pj ? 'CNPJ ou CPF' : 'CPF'}</span>
          <input className={input} inputMode="numeric" value={valor.documento ?? ''} onChange={(e) => set({ documento: mascaraDoc(e.target.value) })} />
        </div>
        {pj ? (
          <div>
            <span className={label}>Representante (nome e cargo)</span>
            <input className={input} value={valor.representante ?? ''} onChange={(e) => set({ representante: e.target.value })} placeholder="Ex.: Fulano, diretor" maxLength={160} />
          </div>
        ) : (
          <div>
            <span className={label}>RG</span>
            <input className={input} value={valor.rg ?? ''} onChange={(e) => set({ rg: e.target.value })} maxLength={30} />
          </div>
        )}
        {!pj && (
          <>
            <div>
              <span className={label}>Nascimento</span>
              <input type="date" className={input} value={valor.nascimento ?? ''} onChange={(e) => set({ nascimento: e.target.value })} />
            </div>
            <div>
              <span className={label}>Estado civil</span>
              <select className={input} value={valor.estadoCivil ?? ''} onChange={(e) => set({ estadoCivil: e.target.value })}>
                <option value="">Selecione</option>
                {Object.entries(ESTADO_CIVIL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={label}>Profissão</span>
              <input className={input} value={valor.profissao ?? ''} onChange={(e) => set({ profissao: e.target.value })} maxLength={80} />
            </div>
          </>
        )}
        <div>
          <span className={label}>Telefone</span>
          <input className={input} inputMode="tel" value={mascaraTel(valor.telefone ?? '')} onChange={(e) => set({ telefone: e.target.value.replace(/\D/g, '') })} />
        </div>
        <div className={pj ? '' : 'sm:col-span-2'}>
          <span className={label}>E-mail</span>
          <input type="email" className={input} value={valor.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
        </div>
      </div>
      <CepField
        value={end}
        onChange={(e) => set({ cep: e.cep, endereco: e.logradouro, bairro: e.bairro, cidade: e.cidade, uf: e.uf })}
      />
      <div>
        <span className={label}>Número e complemento</span>
        <input className={input} value={valor.numero ?? ''} onChange={(e) => set({ numero: e.target.value })} placeholder="Ex.: 120, apto 1502" maxLength={80} />
      </div>
    </div>
  );
}

/** Junta rua + número no campo endereço antes de salvar */
export function fecharEndereco(p: PessoaForm): Pessoa {
  const { numero, ...resto } = p;
  return { ...resto, endereco: [p.endereco, numero].filter(Boolean).join(', ') || undefined };
}

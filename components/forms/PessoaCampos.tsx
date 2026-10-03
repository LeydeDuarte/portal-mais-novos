'use client';

import { useRef, useState } from 'react';
import CepField, { type Endereco } from '../CepField';
import { textoDoArquivo, lerIdentidade, lerComprovante, formatarCpf } from '@/lib/leitura-documentos';
import { ESTADO_CIVIL } from '@/lib/proposta-textos';
import { buscarEmpresas } from '@/lib/actions-empresas';
import { buscarPessoaPorDocumento, consultarCnpjParaProposta } from '@/lib/actions-propostas';
import { formatarCnpj, nomeEmpresa, type Empresa } from '@/lib/empresas-tipos';
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
/** CPF possível (dígitos verificadores). */
function cpfConfere(v: string): boolean {
  const c = v.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export default function PessoaCampos({ valor, onChange, empresa = false }: { valor: PessoaForm; onChange: (p: PessoaForm) => void; empresa?: boolean }) {
  const ref = useRef(valor);
  ref.current = valor;
  const set = (m: Partial<PessoaForm>) => onChange({ ...ref.current, ...m });
  const [avisoDoc, setAvisoDoc] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const ultimoDoc = useRef('');
  // CPF/CNPJ completo: confere o CPF e procura a pessoa no portal (proprietários e propostas)
  const conferirDocumento = async (doc: string) => {
    const dig = doc.replace(/\D/g, '');
    if (dig === ultimoDoc.current) return;
    ultimoDoc.current = dig;
    setAvisoDoc(null);
    if (dig.length === 11 && !cpfConfere(dig)) {
      setAvisoDoc({ tipo: 'erro', texto: 'Este CPF não confere. Verifique os números.' });
      return;
    }
    if (dig.length !== 11 && dig.length !== 14) return;
    let r = await buscarPessoaPorDocumento(dig).catch(() => null);
    // CNPJ que não está no portal: dados públicos da Receita (sem custo)
    if (!r && dig.length === 14) {
      const p = await consultarCnpjParaProposta(doc).catch(() => null);
      if (p) r = { pessoa: p, origem: 'Receita Federal (dados públicos do CNPJ)' };
    }
    if (!r || ultimoDoc.current !== dig) return;
    // preenche só o que ainda está vazio (não apaga o que a pessoa digitou)
    const atual = ref.current as Record<string, unknown>;
    const novo: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r.pessoa)) if (v && !atual[k]) novo[k] = v;
    if (Object.keys(novo).length) set(novo as Partial<PessoaForm>);
    setAvisoDoc({ tipo: 'ok', texto: `Encontrado em ${r.origem}: os campos vazios foram preenchidos.` });
  };
  const [lendo, setLendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sugestoesEmp, setSugestoesEmp] = useState<Empresa[]>([]);
  const buscaEmp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const digitarNome = (nome: string) => {
    set({ nome });
    if (!pjAtivo) return;
    if (buscaEmp.current) clearTimeout(buscaEmp.current);
    if (nome.trim().length < 2) return setSugestoesEmp([]);
    buscaEmp.current = setTimeout(() => buscarEmpresas(nome).then(setSugestoesEmp).catch(() => {}), 250);
  };
  const escolherEmpresa = (e: Empresa) => {
    set({ nome: e.razaoSocial, documento: e.cnpj ? formatarCnpj(e.cnpj) : ref.current.documento, cidade: e.municipio ?? ref.current.cidade, uf: e.uf ?? ref.current.uf });
    setSugestoesEmp([]);
  };
  const pj = empresa || (valor.documento ?? '').replace(/\D/g, '').length > 11;
  const pjAtivo = pj;

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
          <span className={label}>{pj ? 'Empresa: razão social *' : 'Nome completo *'}</span>
          <div className="relative">
            <input
              className={input}
              value={valor.nome}
              onChange={(e) => digitarNome(e.target.value)}
              onBlur={() => setTimeout(() => setSugestoesEmp([]), 200)}
              maxLength={160}
              placeholder={pj ? 'Comece a digitar: aparecem as empresas cadastradas' : ''}
            />
            {pj && sugestoesEmp.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1 shadow-xl">
                {sugestoesEmp.map((e) => (
                  <button key={e.id} type="button" onMouseDown={() => escolherEmpresa(e)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--pill-bg)]">
                    <span className="font-semibold">{nomeEmpresa(e)}</span>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {e.razaoSocial}
                      {e.cnpj ? ` · ${formatarCnpj(e.cnpj)}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <span className={label}>{pj ? 'CNPJ ou CPF' : 'CPF'}</span>
          <input
            className={`${input} ${avisoDoc?.tipo === 'erro' ? 'border-red-400' : ''}`}
            inputMode="numeric"
            value={valor.documento ?? ''}
            onChange={(e) => {
              const v = mascaraDoc(e.target.value);
              set({ documento: v });
              const n = v.replace(/\D/g, '').length;
              // empresa: o CNPJ passa pelos 11 dígitos; só confere no 14º ou ao sair do campo
              if (n === 14 || (n === 11 && !pj)) conferirDocumento(v);
              else setAvisoDoc(null);
            }}
            onBlur={(e) => {
              if (e.target.value.replace(/\D/g, '').length === 11) conferirDocumento(e.target.value);
            }}
          />
          {avisoDoc && <p className={`mt-1 text-xs font-semibold ${avisoDoc.tipo === 'erro' ? 'text-red-600' : 'text-[#13874B]'}`}>{avisoDoc.texto}</p>}
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
        modo="pessoa"
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

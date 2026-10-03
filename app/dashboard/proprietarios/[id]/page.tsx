'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import CepField, { ENDERECO_VAZIO, type Endereco } from '@/components/CepField';
import { TituloPainel, campoPainel } from '@/components/painel/ui';
import { useStaffSession } from '@/lib/use-staff-session';
import {
  desvincularImovel,
  excluirProprietario,
  lerProprietario,
  salvarProprietario,
  vincularImoveis,
  type ImovelDoProprietario
} from '@/lib/actions-proprietarios';
import { listarImoveisPainel, type ImovelPainel } from '@/lib/actions-painel-imoveis';
import { ESTADOS_CIVIS, REGIMES_BENS, faltandoNoCadastro, temConjuge, type Conjuge } from '@/lib/proprietarios-tipos';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { CrmNav } from '@/components/crm/comum';
import { paraBusca } from '@/lib/busca-texto';

// Cadastro completo do proprietário. Tudo o que estiver aqui já sai preenchido na
// proposta; e o que for preenchido na proposta volta para cá (só campos vazios).
type Form = {
  tipo: 'pf' | 'pj';
  nome: string;
  documento: string;
  rg: string;
  nascimento: string;
  nacionalidade: string;
  profissao: string;
  estadoCivil: string;
  regimeBens: string;
  representante: string;
  whatsapp: string;
  email: string;
  observacao: string;
};
const VAZIO: Form = { tipo: 'pf', nome: '', documento: '', rg: '', nascimento: '', nacionalidade: 'Brasileira', profissao: '', estadoCivil: '', regimeBens: '', representante: '', whatsapp: '', email: '', observacao: '' };
const CONJ_VAZIO: Conjuge = { nome: '', documento: '', rg: '', nascimento: '', profissao: '', nacionalidade: 'Brasileira', telefone: '', email: '' };
const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
// busca tolerante: acentos, y/i, w/v, ph/f, letras dobradas (lib/busca-texto.ts)
const sa = paraBusca;

function Campo({ rotulo, children, largo = false }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${largo ? 'sm:col-span-2' : ''}`}>
      <span className="text-[12px] font-semibold text-[var(--text-muted)]">{rotulo}</span>
      {children}
    </label>
  );
}

export default function ProprietarioPage() {
  const { id } = useParams<{ id: string }>();
  const novo = id === 'novo';
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [f, setF] = useState<Form>(VAZIO);
  const [end, setEnd] = useState<Endereco>(ENDERECO_VAZIO);
  const [conj, setConj] = useState<Conjuge>(CONJ_VAZIO);
  const [imoveis, setImoveis] = useState<ImovelDoProprietario[]>([]);
  const [carregado, setCarregado] = useState(novo);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [escolher, setEscolher] = useState(false);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);

  const carregar = async () => {
    const r = await lerProprietario(id).catch(() => null);
    if (!r) {
      setErro('Proprietário não encontrado ou sem permissão.');
      setCarregado(true);
      return;
    }
    const o = r.proprietario;
    setF({
      tipo: o.tipo,
      nome: o.nome,
      documento: o.documento ?? '',
      rg: o.rg ?? '',
      nascimento: o.nascimento ?? '',
      nacionalidade: o.nacionalidade ?? '',
      profissao: o.profissao ?? '',
      estadoCivil: o.estadoCivil ?? '',
      regimeBens: o.regimeBens ?? '',
      representante: o.representante ?? '',
      whatsapp: o.whatsapp ?? '',
      email: o.email ?? '',
      observacao: o.observacao ?? ''
    });
    setEnd({ cep: o.cep ?? '', logradouro: o.endereco ?? '', bairro: o.bairro ?? '', cidade: o.cidade ?? '', uf: o.uf ?? '' });
    setConj({ ...CONJ_VAZIO, ...(o.conjuge ?? {}) });
    setImoveis(r.imoveis);
    setCarregado(true);
  };
  useEffect(() => {
    if (staff && !novo) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, id]);

  const casado = f.tipo === 'pf' && temConjuge(f.estadoCivil);
  const falta = faltandoNoCadastro({
    tipo: f.tipo,
    documento: f.documento || null,
    whatsapp: f.whatsapp || null,
    email: f.email || null,
    endereco: end.logradouro || null,
    cidade: end.cidade || null,
    rg: f.rg || null,
    estadoCivil: f.estadoCivil || null,
    profissao: f.profissao || null,
    representante: f.representante || null,
    conjuge: conj.nome ? conj : null
  });

  if (!loaded || !staff) return <PainelNav />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const setC = <K extends keyof Conjuge>(k: K, v: string) => setConj((x) => ({ ...x, [k]: v }));

  const salvar = async () => {
    setErro(null);
    setAviso(null);
    setSalvando(true);
    try {
      const r = await salvarProprietario({
        id: novo ? undefined : id,
        ...f,
        cep: end.cep,
        endereco: end.logradouro,
        bairro: end.bairro,
        cidade: end.cidade,
        uf: end.uf,
        empresaId: null,
        conjuge: casado && conj.nome ? conj : null
      });
      if (!r.ok) return setErro(r.erro);
      if (novo) {
        router.replace(`/dashboard/proprietarios/${r.proprietario.id}`);
        return;
      }
      setAviso('Cadastro salvo.');
    } catch {
      setErro('Não foi possível salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    const txt = imoveis.length
      ? `Excluir ${f.nome}? Os ${imoveis.length} imóvel(is) ligados continuam no ar, só perdem o vínculo com este proprietário.`
      : `Excluir ${f.nome}?`;
    if (!window.confirm(txt)) return;
    const r = await excluirProprietario(id).catch(() => ({ ok: false, erro: 'Não foi possível excluir.' }));
    if (!r.ok) return setErro(r.erro ?? 'Não foi possível excluir.');
    router.push('/dashboard/proprietarios');
  };

  return (
    <div className="min-h-screen">
      <PainelNav />
      <CrmNav />
      <div className="mx-auto max-w-4xl px-4 pb-28 pt-8 md:px-6">
        <TituloPainel titulo={novo ? 'Novo proprietário' : f.nome || 'Proprietário'} contagem={novo ? 'Só o nome é obrigatório. O resto pode ser completado depois ou na proposta.' : undefined}>
          <Link href="/dashboard/proprietarios" className="flex h-11 items-center rounded-full bg-[var(--pill-bg)] px-4 text-[13px] font-semibold">
            ← Proprietários
          </Link>
        </TituloPainel>

        {!carregado ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            <div className={`rounded-2xl p-4 text-sm ${falta.length ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
              {falta.length ? (
                <>
                  <strong>Para a proposta sair 100% preenchida, falta:</strong> {falta.join(', ')}. Pode salvar assim mesmo; o que for preenchido na proposta volta
                  para este cadastro.
                </>
              ) : (
                <strong>Cadastro completo: a proposta já sai preenchida com os dados deste proprietário{casado ? ' e do cônjuge' : ''}.</strong>
              )}
            </div>

            <section className="rounded-2xl border border-[var(--border)] p-5">
              <div className="mb-4 flex gap-2">
                {(['pf', 'pj'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('tipo', t)}
                    aria-pressed={f.tipo === t}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${f.tipo === t ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}
                  >
                    {t === 'pf' ? 'Pessoa física' : 'Empresa'}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo={f.tipo === 'pj' ? 'Razão social *' : 'Nome completo *'} largo>
                  <input className={campoPainel} value={f.nome} onChange={(e) => set('nome', e.target.value)} />
                </Campo>
                <Campo rotulo={f.tipo === 'pj' ? 'CNPJ' : 'CPF'}>
                  <input className={campoPainel} inputMode="numeric" value={f.documento} onChange={(e) => set('documento', e.target.value)} />
                </Campo>
                {f.tipo === 'pf' ? (
                  <>
                    <Campo rotulo="RG (número e órgão)">
                      <input className={campoPainel} value={f.rg} onChange={(e) => set('rg', e.target.value)} placeholder="1234567 SSP/GO" />
                    </Campo>
                    <Campo rotulo="Data de nascimento">
                      <input className={campoPainel} type="date" value={f.nascimento} onChange={(e) => set('nascimento', e.target.value)} />
                    </Campo>
                    <Campo rotulo="Nacionalidade">
                      <input className={campoPainel} value={f.nacionalidade} onChange={(e) => set('nacionalidade', e.target.value)} />
                    </Campo>
                    <Campo rotulo="Profissão">
                      <input className={campoPainel} value={f.profissao} onChange={(e) => set('profissao', e.target.value)} />
                    </Campo>
                    <Campo rotulo="Estado civil">
                      <select className={campoPainel} value={f.estadoCivil} onChange={(e) => set('estadoCivil', e.target.value)}>
                        <option value="">Selecione</option>
                        {ESTADOS_CIVIS.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Campo>
                    {casado && (
                      <Campo rotulo="Regime de bens">
                        <select className={campoPainel} value={f.regimeBens} onChange={(e) => set('regimeBens', e.target.value)}>
                          <option value="">Selecione</option>
                          {REGIMES_BENS.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Campo>
                    )}
                  </>
                ) : (
                  <Campo rotulo="Representante (quem assina: nome, CPF e cargo)" largo>
                    <input className={campoPainel} value={f.representante} onChange={(e) => set('representante', e.target.value)} />
                  </Campo>
                )}
                <Campo rotulo="Telefone / WhatsApp">
                  <input className={campoPainel} inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="(62) 99999-9999" />
                </Campo>
                <Campo rotulo="E-mail">
                  <input className={campoPainel} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
                </Campo>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border)] p-5">
              <h2 className="mb-3 font-bold">Endereço</h2>
              <CepField modo="pessoa" value={end} onChange={setEnd} />
            </section>

            {casado && (
              <section className="rounded-2xl border border-[var(--border)] p-5">
                <h2 className="font-bold">Cônjuge ou companheiro(a)</h2>
                <p className="mb-3 text-[13px] text-[var(--text-muted)]">Assina a venda junto. Entra na proposta como segundo vendedor.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Nome completo" largo>
                    <input className={campoPainel} value={conj.nome} onChange={(e) => setC('nome', e.target.value)} />
                  </Campo>
                  <Campo rotulo="CPF">
                    <input className={campoPainel} inputMode="numeric" value={conj.documento ?? ''} onChange={(e) => setC('documento', e.target.value)} />
                  </Campo>
                  <Campo rotulo="RG (número e órgão)">
                    <input className={campoPainel} value={conj.rg ?? ''} onChange={(e) => setC('rg', e.target.value)} />
                  </Campo>
                  <Campo rotulo="Data de nascimento">
                    <input className={campoPainel} type="date" value={conj.nascimento ?? ''} onChange={(e) => setC('nascimento', e.target.value)} />
                  </Campo>
                  <Campo rotulo="Profissão">
                    <input className={campoPainel} value={conj.profissao ?? ''} onChange={(e) => setC('profissao', e.target.value)} />
                  </Campo>
                  <Campo rotulo="Telefone">
                    <input className={campoPainel} inputMode="tel" value={conj.telefone ?? ''} onChange={(e) => setC('telefone', e.target.value)} />
                  </Campo>
                  <Campo rotulo="E-mail">
                    <input className={campoPainel} type="email" value={conj.email ?? ''} onChange={(e) => setC('email', e.target.value)} />
                  </Campo>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-[var(--border)] p-5">
              <Campo rotulo="Observação (só a equipe vê)">
                <textarea className={`${campoPainel} min-h-[90px]`} value={f.observacao} onChange={(e) => set('observacao', e.target.value)} />
              </Campo>
            </section>

            {!novo && (
              <section id="imoveis" className="scroll-mt-40 rounded-2xl border border-[var(--border)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold">Imóveis deste proprietário ({imoveis.length})</h2>
                  <button type="button" onClick={() => setEscolher(true)} className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white">
                    + Vincular imóveis
                  </button>
                </div>
                {imoveis.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--text-muted)]">Nenhum imóvel ligado ainda. Use &quot;Vincular imóveis&quot; para escolher entre os já cadastrados.</p>
                ) : (
                  <div className="mt-3 flex flex-col divide-y divide-[var(--border)]">
                    {imoveis.map((i) => (
                      <div key={i.id} className="flex items-center gap-3 py-2.5">
                        <Link href={`/dashboard/imoveis/${i.id}`} className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {i.condominio ? `${i.condominio} · ` : ''}
                            {i.titulo}
                          </div>
                          <div className="text-[12px] text-[var(--text-muted)]">
                            {[i.bairro, i.preco ? brl(i.preco) : null, i.principal ? 'proprietário principal' : null].filter(Boolean).join(' · ')}
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm('Tirar este imóvel do proprietário? O imóvel continua no ar.')) return;
                            await desvincularImovel(id, i.id).catch(() => {});
                            carregar();
                          }}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Tirar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {erro && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{erro}</p>}
            {aviso && <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{aviso}</p>}

            <div className="sticky bottom-4 flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3 shadow-lg">
              <button type="button" onClick={salvar} disabled={salvando || !f.nome.trim()} className="rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {salvando ? 'Salvando…' : novo ? 'Cadastrar proprietário' : 'Salvar cadastro'}
              </button>
              {!novo && (
                <button type="button" onClick={excluir} className="ml-auto rounded-full px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                  Excluir proprietário
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {escolher && (
        <EscolherImoveis
          jaLigados={imoveis.map((i) => i.id)}
          onClose={() => setEscolher(false)}
          onConfirmar={async (ids) => {
            const r = await vincularImoveis(id, ids).catch(() => ({ ok: false as const, erro: 'Não foi possível vincular.' }));
            setEscolher(false);
            if (!r.ok) return setErro(r.erro);
            setAviso(`${r.vinculados} imóvel(is) vinculado(s).`);
            carregar();
          }}
        />
      )}
    </div>
  );
}

// Janela para escolher vários imóveis já cadastrados (busca por condomínio, bairro, código ou título)
function EscolherImoveis({ jaLigados, onClose, onConfirmar }: { jaLigados: string[]; onClose: () => void; onConfirmar: (ids: string[]) => void }) {
  const [todos, setTodos] = useState<ImovelPainel[] | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [soSemDono, setSoSemDono] = useState(false);
  useEffect(() => {
    listarImoveisPainel().then(setTodos).catch(() => setTodos([]));
  }, []);
  const lista = useMemo(() => {
    const t = sa(q.trim());
    return (todos ?? [])
      .filter((i) => !jaLigados.includes(i.id))
      .filter((i) => !soSemDono || !i.proprietarios.length)
      .filter((i) => !t || sa([i.condominio, i.bairro, i.codigo, i.titulo, i.cidade].filter(Boolean).join(' ')).includes(t))
      .slice(0, 300);
  }, [todos, q, jaLigados, soSemDono]);
  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-[var(--bg)] shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[var(--border)] p-4">
          <h3 className="font-bold">Vincular imóveis</h3>
          <input autoFocus className={`${campoPainel} mt-3 w-full`} placeholder="Buscar por condomínio, bairro, código ou título" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="mt-2 flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={soSemDono} onChange={(e) => setSoSemDono(e.target.checked)} /> Só imóveis sem proprietário
          </label>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {!todos ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">Carregando imóveis…</p>
          ) : lista.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">Nenhum imóvel encontrado.</p>
          ) : (
            lista.map((i) => (
              <label key={i.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-2.5 hover:bg-[var(--pill-bg)]">
                <input type="checkbox" checked={sel.has(i.id)} onChange={() => alternar(i.id)} className="h-4 w-4" />
                {i.fotos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.fotos[0]} alt="" className="h-11 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="h-11 w-14 shrink-0 rounded-lg bg-[var(--pill-bg)]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {i.condominio ? `${i.condominio} · ` : ''}
                    {TIPO_UNIDADE_LABEL[i.tipo as TipoUnidade] ?? i.tipo}
                    {i.codigo ? ` · cód. ${i.codigo}` : ''}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--text-muted)]">
                    {[i.bairro, i.preco ? brl(i.preco) : null, i.proprietarios.length ? `dono: ${i.proprietarios.map((o) => o.nome).join(', ')}` : 'sem proprietário'].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
          <span className="text-sm text-[var(--text-muted)]">{sel.size} selecionado(s)</span>
          <button type="button" onClick={onClose} className="ml-auto rounded-full px-4 py-2 text-sm font-semibold hover:bg-[var(--pill-bg)]">
            Cancelar
          </button>
          <button type="button" disabled={!sel.size} onClick={() => onConfirmar(Array.from(sel))} className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            Vincular {sel.size || ''}
          </button>
        </div>
      </div>
    </div>
  );
}

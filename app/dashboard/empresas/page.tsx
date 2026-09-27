'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { atualizarPelaReceita, buscarEmpresas, cadastrarPorCnpj, completarPendentesReceita, contarPendentesReceita, definirCnpj, excluirEmpresa, salvarEmpresa } from '@/lib/actions-empresas';
import { empresaAtiva, formatarCnpj, idadeEmpresa, nomeEmpresa, textoSituacao, type Empresa } from '@/lib/empresas-tipos';
import { SITE_URL } from '@/lib/seo';

const input = 'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-accent';

// Construtoras e incorporadoras: cadastro pelo CNPJ (dados da Receita) e o texto
// do perfil informativo (nome fantasia e breve histórico).
export default function EmpresasPainel() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<Empresa[] | null>(null);
  const [cnpj, setCnpj] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [editando, setEditando] = useState<Empresa | null>(null);
  const [form, setForm] = useState({ nomeFantasia: '', historico: '' });
  const [ocupado, setOcupado] = useState(false);
  const [soSemCnpj, setSoSemCnpj] = useState(false);
  const [pendentes, setPendentes] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [cnpjDe, setCnpjDe] = useState<Record<string, string>>({});
  const gestor = veTudo(staff?.role);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = (t = q) => {
    contarPendentesReceita().then(setPendentes).catch(() => {});
    return buscarEmpresas(t).then(setLista).catch(() => setLista([]));
  };
  useEffect(() => {
    if (!staff) return;
    const tm = setTimeout(() => carregar(q), 250);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, staff]);
  if (!loaded || !staff) return null;

  const cadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setMsg({ ok: true, t: 'Consultando a Receita Federal…' });
    const r = await cadastrarPorCnpj(cnpj).catch(() => ({ ok: false as const, erro: 'Falha na consulta.' }));
    setOcupado(false);
    if (!r.ok) return setMsg({ ok: false, t: r.erro });
    setMsg({ ok: true, t: r.nova ? `${nomeEmpresa(r.empresa)} cadastrada.` : `${nomeEmpresa(r.empresa)} já estava cadastrada.` });
    setCnpj('');
    carregar();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Construtoras e incorporadoras</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Cadastre pelo CNPJ: nome, situação cadastral e data de abertura vêm da Receita Federal (Minha Receita). Depois vincule no campo
          &quot;Concepção&quot; de cada empreendimento. Cada empresa ganha um perfil público em maisnovosimoveis.com/empresa/…
        </p>

        <form onSubmit={cadastrar} className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] p-4">
          <input className={`${input} max-w-xs`} value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="CNPJ (só números ou com pontos)" inputMode="numeric" />
          <button disabled={ocupado} className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {ocupado ? 'Consultando…' : 'Cadastrar pela Receita'}
          </button>
          {msg && <p className={`w-full text-sm ${msg.ok ? 'text-accent' : 'text-red-600'}`}>{msg.t}</p>}
        </form>

        {pendentes > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            <span className="flex-1">
              <strong>{pendentes}</strong> empresa(s) com CNPJ ainda sem os dados da Receita (vieram da planilha).
            </span>
            <button
              type="button"
              disabled={buscando}
              onClick={async () => {
                setBuscando(true);
                const falhas: string[] = [];
                let restantes = pendentes;
                try {
                  // de pouco em pouco, para não estourar o limite de consultas da Receita
                  for (let i = 0; i < 60 && restantes > 0; i++) {
                    const r = await completarPendentesReceita(4);
                    falhas.push(...r.falhas);
                    restantes = r.restantes;
                    setPendentes(restantes);
                    if (r.feitos === 0) break;
                  }
                } finally {
                  setBuscando(false);
                  setMsg(falhas.length ? { ok: false, t: falhas.slice(0, 5).join(' · ') } : { ok: true, t: 'Dados da Receita atualizados.' });
                  carregar();
                }
              }}
              className="rounded-full bg-amber-600 px-4 py-2 font-bold text-white disabled:opacity-60"
            >
              {buscando ? 'Buscando…' : 'Buscar dados na Receita'}
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input className={`${input} min-w-[220px] flex-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou CNPJ" />
          <button
            type="button"
            onClick={() => setSoSemCnpj((v) => !v)}
            className={`rounded-full px-4 py-2.5 text-sm font-semibold ${soSemCnpj ? 'bg-amber-500 text-white' : 'bg-[var(--pill-bg)]'}`}
          >
            Sem CNPJ{lista ? ` (${lista.filter((x) => !x.cnpj).length})` : ''}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {lista === null ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma empresa{q ? ' com essa busca' : ' cadastrada ainda'}.</p>
          ) : (
            lista.filter((e) => !soSemCnpj || !e.cnpj).map((e) => {
              const idade = idadeEmpresa(e.dataInicio);
              const aberto = editando?.id === e.id;
              return (
                <div key={e.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className={`font-bold ${empresaAtiva(e) ? '' : 'text-[var(--text-faint)]'}`}>{nomeEmpresa(e)}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {e.cnpj ? (
                          <>
                            {e.razaoSocial} · CNPJ {formatarCnpj(e.cnpj)}
                          </>
                        ) : (
                          <span className="font-bold text-amber-700">Sem CNPJ (cadastrada pelo nome)</span>
                        )}
                        <br />
                        {[textoSituacao(e), idade ? `${idade.texto} de empresa` : null, e.municipio ? `${e.municipio}/${e.uf}` : null, `${e.totalEmpreendimentos ?? 0} empreendimento(s)`]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <a href={`${SITE_URL}/empresa/${e.slug}`} target="_blank" rel="noopener" className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-[var(--pill-bg)]">
                      Ver perfil
                    </a>
                    {e.cnpj && <button
                      type="button"
                      onClick={async () => {
                        setMsg(null);
                        const r = await atualizarPelaReceita(e.id);
                        setMsg(r.ok ? { ok: true, t: `${nomeEmpresa(r.empresa!)}: dados atualizados pela Receita.` } : { ok: false, t: r.erro ?? 'Falhou.' });
                        carregar();
                      }}
                      className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-[var(--pill-bg)]"
                    >
                      Atualizar da Receita
                    </button>}
                    {gestor && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(aberto ? null : e);
                          setForm({ nomeFantasia: e.nomeFantasia ?? '', historico: e.historico ?? '' });
                        }}
                        className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-white"
                      >
                        {aberto ? 'Fechar' : 'Editar perfil'}
                      </button>
                    )}
                  </div>
                  {!e.cnpj && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        className={`${input} max-w-xs`}
                        inputMode="numeric"
                        placeholder="Informe o CNPJ"
                        value={cnpjDe[e.id] ?? ''}
                        onChange={(ev) => setCnpjDe({ ...cnpjDe, [e.id]: ev.target.value })}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          setMsg({ ok: true, t: 'Consultando a Receita Federal…' });
                          const r = await definirCnpj(e.id, cnpjDe[e.id] ?? '').catch(() => ({ ok: false as const, erro: 'Falha na consulta.' }));
                          if (!r.ok) return setMsg({ ok: false, t: r.erro });
                          setMsg({
                            ok: true,
                            t: r.juntou
                              ? `Esse CNPJ já era de ${nomeEmpresa(r.empresa)}: as duas foram juntadas e os empreendimentos passaram para ela.`
                              : `${nomeEmpresa(r.empresa)}: CNPJ gravado e dados da Receita atualizados.`
                          });
                          carregar();
                        }}
                        className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white"
                      >
                        Gravar CNPJ
                      </button>
                    </div>
                  )}
                  {aberto && (
                    <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4">
                      <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        Nome fantasia (como aparece no site)
                        <input className={`${input} mt-1 normal-case`} value={form.nomeFantasia} onChange={(ev) => setForm({ ...form, nomeFantasia: ev.target.value })} placeholder={e.razaoSocial} />
                      </label>
                      <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        Breve histórico ({form.historico.length}/2000)
                        <textarea
                          className={`${input} mt-1 min-h-[140px] normal-case`}
                          value={form.historico}
                          maxLength={2000}
                          onChange={(ev) => setForm({ ...form, historico: ev.target.value })}
                          placeholder="Fundação, sócios fundadores, obras marcantes, especialidade (alto padrão, horizontal…), cidades onde atua."
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await salvarEmpresa(e.id, form);
                            setEditando(null);
                            setMsg({ ok: true, t: 'Perfil salvo.' });
                            carregar();
                          }}
                          className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-white"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Apagar ${nomeEmpresa(e)}?`)) return;
                            const r = await excluirEmpresa(e.id);
                            setMsg(r.ok ? { ok: true, t: 'Empresa apagada.' } : { ok: false, t: r.erro ?? 'Falhou.' });
                            setEditando(null);
                            carregar();
                          }}
                          className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          Apagar empresa
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

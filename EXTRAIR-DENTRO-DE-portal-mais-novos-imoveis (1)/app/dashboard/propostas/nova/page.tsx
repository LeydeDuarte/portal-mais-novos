'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import PessoaCampos, { input, label, fecharEndereco, type PessoaForm } from '@/components/forms/PessoaCampos';
import { useStaffSession } from '@/lib/use-staff-session';
import {
  buscarAlvos,
  carregarAlvo,
  getProposta,
  meuCorretor,
  salvarProposta,
  type AlvoProposta,
  type Corretor,
  type OpcaoAlvo
} from '@/lib/actions-propostas';
import { brl } from '@/lib/proposta-textos';

const moeda = (v: string | number) => {
  const d = String(v).replace(/\D/g, '').slice(0, 12);
  return d ? Number(d).toLocaleString('pt-BR') : '';
};
const numero = (v: string) => Number(v.replace(/\D/g, '')) || 0;

function NovaProposta() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const sp = useSearchParams();
  const editId = sp.get('id');

  const [alvo, setAlvo] = useState<AlvoProposta | null>(null);
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<OpcaoAlvo[]>([]);
  const [imovelTexto, setImovelTexto] = useState('');
  const [unidade, setUnidade] = useState('');
  const [compradores, setCompradores] = useState<PessoaForm[]>([{ nome: '' }]);
  const [vendedores, setVendedores] = useState<(PessoaForm & { pj?: boolean })[]>([{ nome: '' }]);
  const [guardarVendedor, setGuardarVendedor] = useState(false);
  const [corretor, setCorretor] = useState<Corretor>({ nome: '' });
  const [valor, setValor] = useState('');
  const [condicoes, setCondicoes] = useState('');
  const [validade, setValidade] = useState(5);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const iniciou = useRef(false);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);

  const escolherAlvo = async (tipo: AlvoProposta['tipo'], id: string) => {
    const a = await carregarAlvo(tipo, id).catch(() => null);
    if (!a) return;
    setAlvo(a);
    setImovelTexto(a.titulo);
    setOpcoes([]);
    setBusca('');
    if (a.vendedores.length) setVendedores(a.vendedores.map((v) => ({ ...v, pj: (v.documento ?? '').replace(/\D/g, '').length > 11 })));
    setGuardarVendedor(!a.vendedores.length);
  };

  // abre já com o imóvel (?imovel= / ?tipologia= / ?condominio=) ou editando (?id=)
  useEffect(() => {
    if (!staff || iniciou.current) return;
    iniciou.current = true;
    meuCorretor().then(setCorretor).catch(() => {});
    if (editId) {
      getProposta(editId).then((p) => {
        if (!p) return;
        setImovelTexto(p.imovelTexto ?? '');
        setUnidade(p.unidade ?? '');
        setCompradores(p.compradores.length ? p.compradores : [p.comprador]);
        if (p.vendedores.length) setVendedores(p.vendedores.map((v) => ({ ...v, pj: (v.documento ?? '').replace(/\D/g, '').length > 11 })));
        if (p.corretor) setCorretor(p.corretor);
        setValor(moeda(p.valor));
        setCondicoes(p.condicoes ?? '');
        setValidade(p.validadeDias);
        if (p.propertyId) carregarAlvo('imovel', p.propertyId).then((a) => a && setAlvo(a));
        else if (p.developmentId) carregarAlvo('condominio', p.developmentId).then((a) => a && setAlvo(a));
      });
      return;
    }
    const im = sp.get('imovel') ?? sp.get('tipologia');
    const co = sp.get('condominio');
    if (im) escolherAlvo('imovel', im);
    else if (co) escolherAlvo('condominio', co);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  useEffect(() => {
    const q = busca.trim();
    if (q.length < 2) return setOpcoes([]);
    const tm = setTimeout(() => buscarAlvos(q).then(setOpcoes).catch(() => {}), 250);
    return () => clearTimeout(tm);
  }, [busca]);

  if (!loaded || !staff) return null;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const r = await salvarProposta({
        id: editId ?? undefined,
        alvo: alvo ? { tipo: alvo.tipo, id: alvo.id } : null,
        imovelTexto,
        unidade,
        compradores: compradores.filter((c) => c.nome.trim()).map(fecharEndereco),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        vendedores: vendedores.filter((v) => v.nome.trim()).map(({ pj, ...v }) => fecharEndereco(v)),
        corretor,
        valor: numero(valor),
        condicoes,
        validadeDias: validade,
        guardarVendedor: guardarVendedor && alvo ? (alvo.tipo === 'imovel' ? 'imovel' : 'condominio') : null
      });
      if (!r.ok || !r.id) {
        setErro(r.erro ?? 'Não foi possível salvar.');
        return;
      }
      router.push(`/dashboard/propostas/${r.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const Secao = ({ n, titulo, children, dica }: { n: number; titulo: string; dica?: string; children: React.ReactNode }) => (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-5">
      <h2 className="text-lg font-bold">
        <span className="mr-2 text-accent">{n}.</span>
        {titulo}
      </h2>
      {dica && <p className="-mt-2 text-xs text-[var(--text-muted)]">{dica}</p>}
      {children}
    </section>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">{editId ? 'Editar proposta' : 'Nova proposta'}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Uso interno: a proposta fica salva no painel (nunca aparece no site) e sai em PDF com as assinaturas do comprador, do vendedor e do corretor.
        </p>

        <form onSubmit={salvar} className="mt-6 flex flex-col gap-5">
          {Secao({
            n: 1,
            titulo: 'Imóvel',
            dica: 'Anúncio, tipologia ou condomínio. Pode haver várias propostas no mesmo imóvel.',
            children: (
              <>
                {alvo ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--pill-bg)] px-4 py-3 text-sm">
                    <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      {alvo.tipo === 'condominio' ? 'Condomínio' : alvo.tipo === 'tipologia' ? 'Tipologia' : 'Anúncio'}
                    </span>
                    <span className="min-w-0 flex-1 font-semibold">{alvo.titulo}</span>
                    {alvo.valorAnunciado ? <span className="text-[var(--text-muted)]">anunciado por {brl(alvo.valorAnunciado)}</span> : null}
                    <button type="button" onClick={() => setAlvo(null)} className="text-xs font-bold text-accent">
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      className={input}
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por condomínio, título, bairro ou código"
                    />
                    {opcoes.length > 0 && (
                      <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1 shadow-xl">
                        {opcoes.map((o) => (
                          <button
                            key={`${o.tipo}-${o.id}`}
                            type="button"
                            onClick={() => escolherAlvo(o.tipo, o.id)}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--pill-bg)]"
                          >
                            <span className="font-semibold">{o.titulo}</span>
                            <span className="block text-xs text-[var(--text-muted)]">{o.detalhe}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <span className={label}>Descrição do imóvel no documento *</span>
                  <textarea className={`${input} min-h-[70px]`} value={imovelTexto} onChange={(e) => setImovelTexto(e.target.value)} maxLength={400} />
                </div>
                <div>
                  <span className={label}>Unidade (apto, torre, quadra/lote, matrícula)</span>
                  <input className={input} value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Ex.: Apto 1502, Torre A, matrícula 123.456" maxLength={120} />
                </div>
              </>
            )
          })}

          {Secao({
            n: 2,
            titulo: compradores.length > 1 ? 'Compradores (proponentes)' : 'Comprador (proponente)',
            children: (
              <>
                {compradores.map((c, i) => (
                  <div key={i} className={i > 0 ? 'border-t border-[var(--border)] pt-4' : ''}>
                    {compradores.length > 1 && (
                      <div className="mb-2 flex items-center justify-between text-sm font-bold">
                        Comprador {i + 1}
                        <button type="button" onClick={() => setCompradores(compradores.filter((_, j) => j !== i))} className="text-xs font-semibold text-red-600">
                          Tirar
                        </button>
                      </div>
                    )}
                    <PessoaCampos valor={c} onChange={(v) => setCompradores((l) => l.map((x, j) => (j === i ? v : x)))} />
                  </div>
                ))}
                <button type="button" onClick={() => setCompradores([...compradores, { nome: '' }])} className="w-fit rounded-full border border-dashed border-accent px-4 py-2 text-sm font-bold text-accent">
                  + Acrescentar comprador
                </button>
              </>
            )
          })}

          {Secao({
            n: 3,
            titulo: vendedores.length > 1 ? 'Vendedores (proprietários ou construtora)' : 'Vendedor (proprietário ou construtora)',
            dica: alvo?.vendedorOrigem
              ? `Preenchido com o vendedor guardado ${alvo.vendedorOrigem === 'imovel' ? 'neste anúncio' : 'neste condomínio'}.`
              : 'Guarde os vendedores para as próximas propostas deste imóvel já saírem preenchidas.',
            children: (
              <>
                {vendedores.map((v, i) => (
                  <div key={i} className={`flex flex-col gap-3 ${i > 0 ? 'border-t border-[var(--border)] pt-4' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      {vendedores.length > 1 && <span className="mr-1 text-sm font-bold">Vendedor {i + 1}</span>}
                      {[
                        [false, 'Pessoa física'],
                        [true, 'Empresa']
                      ].map(([pj, rot]) => (
                        <button
                          key={String(pj)}
                          type="button"
                          onClick={() => setVendedores((l) => l.map((x, j) => (j === i ? { ...x, pj: pj as boolean } : x)))}
                          className={`rounded-full px-3.5 py-2 text-sm font-semibold ${!!v.pj === pj ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}
                        >
                          {rot as string}
                        </button>
                      ))}
                      {vendedores.length > 1 && (
                        <button type="button" onClick={() => setVendedores(vendedores.filter((_, j) => j !== i))} className="ml-auto text-xs font-semibold text-red-600">
                          Tirar
                        </button>
                      )}
                    </div>
                    <PessoaCampos valor={v} empresa={!!v.pj} onChange={(nv) => setVendedores((l) => l.map((x, j) => (j === i ? { ...nv, pj: x.pj } : x)))} />
                  </div>
                ))}
                <button type="button" onClick={() => setVendedores([...vendedores, { nome: '' }])} className="w-fit rounded-full border border-dashed border-accent px-4 py-2 text-sm font-bold text-accent">
                  + Acrescentar vendedor
                </button>
                {alvo && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={guardarVendedor} onChange={(e) => setGuardarVendedor(e.target.checked)} />
                    Guardar como vendedor(es) padrão {alvo.tipo === 'imovel' ? 'deste anúncio' : 'deste condomínio (vale para as tipologias)'}
                  </label>
                )}
              </>
            )
          })}

          {Secao({
            n: 4,
            titulo: 'Corretor responsável',
            children: (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className={label}>Nome</span>
                  <input className={input} value={corretor.nome} onChange={(e) => setCorretor({ ...corretor, nome: e.target.value })} />
                </div>
                <div>
                  <span className={label}>CRECI</span>
                  <input className={input} value={corretor.creci ?? ''} onChange={(e) => setCorretor({ ...corretor, creci: e.target.value })} placeholder="Fica guardado para as próximas" />
                </div>
              </div>
            )
          })}

          {Secao({
            n: 5,
            titulo: 'Valor e condições de pagamento',
            children: (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className={label}>Valor total da proposta (R$) *</span>
                    <input className={input} inputMode="numeric" value={valor} onChange={(e) => setValor(moeda(e.target.value))} />
                  </div>
                  <div>
                    <span className={label}>Validade</span>
                    <select className={input} value={validade} onChange={(e) => setValidade(Number(e.target.value))}>
                      {[3, 5, 7, 10, 15, 30].map((n) => (
                        <option key={n} value={n}>
                          {n} dias
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-accent/40 bg-accent/5 p-4">
                  <span className="mb-1 block text-sm font-bold uppercase tracking-wide text-accent">Condições de pagamento *</span>
                  <p className="mb-2 text-xs text-[var(--text-muted)]">
                    Descreva tudo: se é à vista, sinal, parcelas, financiamento, FGTS, permuta, prazos e posse. Vai em destaque no documento, sem limite de texto.
                  </p>
                  <textarea
                    className={`${input} min-h-[200px] bg-[var(--bg)]`}
                    value={condicoes}
                    onChange={(e) => setCondicoes(e.target.value)}
                    placeholder={'Ex.:\nSinal de R$ 50.000 na assinatura do contrato;\nSaldo de R$ 450.000 por financiamento bancário em até 60 dias;\nPosse na entrega das chaves após a quitação.'}
                  />
                </div>
              </>
            )
          })}

          {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}
          <button disabled={salvando} className="rounded-full bg-accent px-6 py-3.5 text-[15px] font-bold text-white disabled:opacity-60">
            {salvando ? 'Salvando…' : editId ? 'Salvar e ver o PDF' : 'Salvar proposta e ver o PDF'}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NovaProposta />
    </Suspense>
  );
}

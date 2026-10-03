'use client';

// CRM · Funis: Vendas (com pós-venda) e Captação; os outros em "Outros funis".
// O quadro ocupa a altura da tela e cada coluna rola por dentro. Ao arrastar um
// cartão, a faixa "ganho / perdido" aparece fixa no rodapé. No funil de Vendas o
// ganho é o CONTRATO ASSINADO (data e valor) e o cartão segue no pós-venda.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { CanalChip, CrmNav, Iniciais, NotaChip, OrigemChip, brl } from '@/components/crm/comum';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { contratoAssinado, crmFunil, moverNegocio, moverPosVenda, type CardNegocio } from '@/lib/actions-crm';
import { FUNIS, FUNIS_PRINCIPAIS, type Funil } from '@/lib/crm-tipos';

const CORES = ['#8AA4C8', '#257CFF', '#6A3CFF', '#E08A00', '#C2410C', '#0F6E56', '#13874B', '#7A8B99'];
const hojeIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function CrmFunilPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const busca = useSearchParams();
  const fUrl = busca?.get('f');
  const funil: Funil = (FUNIS.find((x) => x.id === fUrl)?.id ?? 'comprar') as Funil;
  const [corretor, setCorretor] = useState('');
  const [d, setD] = useState<Awaited<ReturnType<typeof crmFunil>> | null>(null);
  const [arrastando, setArrastando] = useState<CardNegocio | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState<{ card: CardNegocio; data: string; valor: string } | null>(null);
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () =>
    crmFunil(funil, corretor || undefined)
      .then(setD)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  useEffect(() => {
    if (staff) {
      setD(null);
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, funil, corretor]);
  if (!loaded || !staff) return null;
  const gestor = veTudo(staff.role);
  const vendas = funil === 'comprar';
  const trocarFunil = (f: string) => router.replace(`/dashboard/crm/funil?f=${f}`);

  const coluna = (c: CardNegocio) => (c.etapa === 'ganho' && c.posVenda ? `pv:${c.posVenda}` : c.etapa);
  const atualizar = (id: string, m: Partial<CardNegocio> | null) =>
    setD((x) => (x ? { ...x, cards: m === null ? x.cards.filter((c) => c.id !== id) : x.cards.map((c) => (c.id === id ? { ...c, ...m } : c)) } : x));

  // destino: etapa normal, "ganho", "perdido", "pv:entrega", "pv:depoimento" ou "pv:concluido"
  const mover = async (c: CardNegocio, destino: string) => {
    setErro(null);
    if (destino === coluna(c)) return;
    try {
      if (destino.startsWith('pv:')) {
        if (c.etapa !== 'ganho') {
          // chegar no pós-venda = contrato assinado
          setAssinatura({ card: c, data: hojeIso(), valor: c.valor ? String(Math.round(c.valor)) : '' });
          return;
        }
        const pv = destino.slice(3) as 'entrega' | 'depoimento' | 'concluido';
        atualizar(c.id, pv === 'concluido' ? null : { posVenda: pv, diasNaEtapa: 0 });
        await moverPosVenda(c.id, pv);
        return;
      }
      if (destino === 'ganho' && vendas) {
        setAssinatura({ card: c, data: hojeIso(), valor: c.valor ? String(Math.round(c.valor)) : '' });
        return;
      }
      let motivo: string | undefined;
      if (destino === 'perdido') {
        const m = window.prompt('Por que foi perdido? (opcional)');
        if (m === null) return;
        motivo = m;
      }
      atualizar(c.id, destino === 'ganho' || destino === 'perdido' ? null : { etapa: destino, diasNaEtapa: 0 });
      await moverNegocio(c.id, destino, motivo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível mover.');
      carregar();
    }
  };

  const confirmarAssinatura = async () => {
    if (!assinatura) return;
    const { card, data } = assinatura;
    const valor = Number(assinatura.valor.replace(/\D/g, '')) || null;
    setAssinatura(null);
    atualizar(card.id, { etapa: 'ganho', posVenda: 'entrega', valor: valor ?? card.valor, diasNaEtapa: 0 });
    try {
      await contratoAssinado(card.id, data, valor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar o contrato.');
      carregar();
    }
  };

  const soltar = (destino: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setSobre(destino);
    },
    onDragLeave: () => setSobre((s) => (s === destino ? null : s)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (arrastando) mover(arrastando, destino);
      setArrastando(null);
      setSobre(null);
    }
  });

  const opcoesMover = (c: CardNegocio) => {
    if (c.etapa === 'ganho')
      return (d?.posVenda ?? []).map((p) => ({ v: `pv:${p.id}`, l: p.nome })).concat([{ v: 'pv:concluido', l: 'Pós-venda concluído' }]);
    return [
      ...(d?.etapas ?? []).map((e) => ({ v: e.id, l: e.nome })),
      { v: 'ganho', l: vendas ? 'Contrato assinado (ganho)' : 'Ganho' },
      { v: 'perdido', l: 'Perdido' }
    ];
  };

  const Card = ({ c }: { c: CardNegocio }) => (
    <div
      draggable
      onDragStart={() => setArrastando(c)}
      onDragEnd={() => {
        setArrastando(null);
        setSobre(null);
      }}
      className={`flex cursor-grab flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5 active:cursor-grabbing ${arrastando?.id === c.id ? 'opacity-40' : ''}`}
    >
      <Link href={`/dashboard/crm/contato/${c.contatoId}`} className="flex items-center gap-2">
        <Iniciais nome={c.nome} tam={26} />
        <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{c.nome}</b>
        {gestor && c.corretor && (
          <span title={c.corretor} className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#14161A] text-[9px] font-bold text-white">
            {c.corretor.slice(0, 2).toUpperCase()}
          </span>
        )}
      </Link>
      {c.titulo && <div className="truncate text-[12px] text-[var(--text-muted)]">{c.titulo}</div>}
      <div className="flex flex-wrap items-center gap-1">
        {c.valor ? <span className="rounded-full bg-[var(--pill-bg)] px-1.5 py-px text-[10.5px] font-semibold tabular-nums">{brl(c.valor)}</span> : null}
        <OrigemChip origem={c.origem} />
        <CanalChip canal={c.canal} />
        {c.etapa !== 'ganho' && <NotaChip nota={c.nota} />}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <span>{c.diasNaEtapa === 0 ? 'hoje nesta etapa' : `${c.diasNaEtapa} dia${c.diasNaEtapa > 1 ? 's' : ''} aqui`}</span>
        {c.proximaTarefa && <span className={`truncate font-semibold ${c.proximaTarefa.atrasada ? 'text-[#C2410C]' : ''}`}>{c.proximaTarefa.titulo}</span>}
      </div>
      {/* sem arrastar (celular ou teclado): mover por aqui */}
      <select
        aria-label="Mover para"
        value=""
        onChange={(e) => e.target.value && mover(c, e.target.value)}
        className="mt-0.5 h-7 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-1.5 text-[11.5px] text-[var(--text-muted)] md:hidden"
      >
        <option value="">Mover para…</option>
        {opcoesMover(c).map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );

  const Coluna = ({ id, nome, cor, cards }: { id: string; nome: string; cor: string; cards: CardNegocio[] }) => (
    <section {...soltar(id)} className="flex h-full w-[248px] shrink-0 flex-col md:w-auto md:min-w-[200px] md:flex-1">
      <div className="flex items-center gap-1.5 px-1 pb-1.5">
        <h2 className="truncate text-[12.5px] font-semibold">{nome}</h2>
        <span className="text-[11.5px] text-[var(--text-muted)] tabular-nums">{cards.length}</span>
        <span className="ml-auto text-[11px] font-semibold text-[var(--text-muted)] tabular-nums">{brl(cards.reduce((a, c) => a + (c.valor ?? 0), 0)) || ''}</span>
      </div>
      <div
        className={`flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl border-t-[3px] p-1.5 [scrollbar-width:thin] ${sobre === id ? 'bg-[#DCE8FF]' : 'bg-[var(--pill-bg)]'}`}
        style={{ borderTopColor: cor }}
      >
        {cards
          .slice()
          .sort((a, b) => b.nota.valor - a.nota.valor)
          .map((c) => (
            <Card key={c.id} c={c} />
          ))}
        {cards.length === 0 && <div className="px-2 py-4 text-center text-[11.5px] text-[var(--text-muted)]">Nenhum aqui</div>}
      </div>
    </section>
  );

  const outros = FUNIS.filter((f) => !FUNIS_PRINCIPAIS.includes(f.id));
  const arrastandoPos = arrastando?.etapa === 'ganho';

  return (
    <div className="flex h-[100dvh] flex-col">
      <PainelNav />
      <CrmNav />
      <main className="flex min-h-0 w-full flex-1 flex-col px-4 pb-3 pt-4 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-1 font-serif text-[20px] font-semibold tracking-tight">{vendas ? 'Funil de vendas' : funil === 'vender' ? 'Funil de captação' : FUNIS.find((f) => f.id === funil)?.nome}</h1>
          <span className="text-[12.5px] text-[var(--text-muted)]">{d ? `${d.cards.filter((c) => c.etapa !== 'ganho').length} em andamento` : ''}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {funil === 'vender' && (
              <Link href="/dashboard/vender" className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-accent hover:bg-[var(--pill-bg)]">
                Pedidos de venda do site
              </Link>
            )}
            <select
              value={FUNIS_PRINCIPAIS.includes(funil) ? '' : funil}
              onChange={(e) => e.target.value && trocarFunil(e.target.value)}
              className="h-9 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-[12.5px] font-semibold"
              aria-label="Outros funis"
            >
              <option value="">Outros funis</option>
              {outros.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
            {gestor && d && (
              <select value={corretor} onChange={(e) => setCorretor(e.target.value)} className="h-9 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-[12.5px] font-semibold">
                <option value="">Corretor: todos</option>
                {d.corretores.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        {erro && <p className="mt-2 rounded-xl bg-red-50 p-2.5 text-[13px] text-red-700">{erro}</p>}
        {!d ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {d.etapas.map((e, i) => (
              <Coluna key={e.id} id={e.id} nome={e.nome} cor={CORES[i % CORES.length]} cards={d.cards.filter((c) => coluna(c) === e.id)} />
            ))}
            {d.posVenda.length > 0 && (
              <>
                <div className="flex shrink-0 flex-col items-center px-1 pt-6" aria-hidden>
                  <div className="w-px flex-1 bg-[var(--border)]" />
                  <span className="my-2 rotate-180 text-[11px] font-semibold text-[#13874B] [writing-mode:vertical-rl]">Ganho · pós-venda</span>
                  <div className="w-px flex-1 bg-[var(--border)]" />
                </div>
                {d.posVenda.map((p) => (
                  <Coluna key={p.id} id={`pv:${p.id}`} nome={p.nome} cor="#13874B" cards={d.cards.filter((c) => coluna(c) === `pv:${p.id}`)} />
                ))}
              </>
            )}
          </div>
        )}
      </main>

      {/* faixa fixa no rodapé, só enquanto um cartão é arrastado */}
      {arrastando && (
        <div className="fixed inset-x-0 bottom-0 z-40 hidden gap-3 border-t border-[var(--border)] bg-[var(--bg)]/95 px-6 py-3 backdrop-blur md:flex">
          {arrastandoPos ? (
            <div {...soltar('pv:concluido')} className={`flex-1 rounded-2xl border-2 border-dashed border-[#0B6B33] bg-[#E7F9EE] p-3.5 text-center text-sm font-semibold text-[#0B6B33] ${sobre === 'pv:concluido' ? 'ring-2 ring-[#0B6B33]' : ''}`}>
              Solte aqui: pós-venda concluído
            </div>
          ) : (
            <>
              <div {...soltar('ganho')} className={`flex-1 rounded-2xl border-2 border-dashed border-[#0B6B33] bg-[#E7F9EE] p-3.5 text-center text-sm font-semibold text-[#0B6B33] ${sobre === 'ganho' ? 'ring-2 ring-[#0B6B33]' : ''}`}>
                {vendas ? 'Solte aqui: contrato assinado (ganho)' : 'Solte aqui: ganho'}
              </div>
              <div {...soltar('perdido')} className={`flex-1 rounded-2xl border-2 border-dashed border-[#B42318] bg-[#FDECEC] p-3.5 text-center text-sm font-semibold text-[#B42318] ${sobre === 'perdido' ? 'ring-2 ring-[#B42318]' : ''}`}>
                Solte aqui: perdido
              </div>
            </>
          )}
        </div>
      )}

      {/* contrato assinado: data e valor final */}
      {assinatura && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="titulo-contrato">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--bg)] p-5 shadow-xl">
            <h2 id="titulo-contrato" className="font-serif text-[18px] font-semibold">
              Contrato assinado
            </h2>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              {assinatura.card.nome}: o negócio passa a contar como ganho e segue para a entrega do imóvel.
            </p>
            <label className="mt-4 flex flex-col gap-1 text-[12.5px] font-semibold">
              Data da assinatura
              <input type="date" max={hojeIso()} value={assinatura.data} onChange={(e) => setAssinatura({ ...assinatura, data: e.target.value })} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-[14px] font-normal" />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-[12.5px] font-semibold">
              Valor final do negócio (R$)
              <input
                inputMode="numeric"
                value={assinatura.valor ? Number(assinatura.valor.replace(/\D/g, '')).toLocaleString('pt-BR') : ''}
                onChange={(e) => setAssinatura({ ...assinatura, valor: e.target.value.replace(/\D/g, '') })}
                placeholder="1.250.000"
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-[14px] font-normal tabular-nums"
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={confirmarAssinatura} disabled={!assinatura.data} className="h-10 flex-1 rounded-full bg-[#13874B] text-[14px] font-semibold text-white disabled:opacity-50">
                Registrar ganho
              </button>
              <button type="button" onClick={() => setAssinatura(null)} className="h-10 rounded-full border border-[var(--border)] px-4 text-[14px] font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

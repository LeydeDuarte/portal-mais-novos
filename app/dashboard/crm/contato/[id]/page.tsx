'use client';

// CRM · Ficha do contato: o que procura, a jornada no portal, a linha do tempo,
// o negócio, as tarefas e as ações (WhatsApp, nota, ligação, transferir, marcar corretor).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { CanalChip, CrmNav, Iniciais, NotaChip, OrigemChip, brl, dataHora, linkWhats, tempoDesde } from '@/components/crm/comum';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import {
  atribuirContato,
  concluirTarefa,
  conversaWhatsapp,
  crmContato,
  enviarMensagemWhatsapp,
  ligarIaNoContato,
  marcarTipo,
  moverNegocio,
  registrarAtividade,
  salvarTarefa,
  type FichaContato
} from '@/lib/actions-crm';
import { FUNIS } from '@/lib/crm-tipos';
import SelecionarImoveis from '@/components/crm/SelecionarImoveis';
import { numeroProposta } from '@/lib/proposta-textos';

const ICONE_ATV: Record<string, string> = { entrada: '→', whatsapp: 'W', ligacao: 'L', visita: 'V', nota: 'N', simulacao: 'S', sistema: '•', envio: '↗', abriu: '✓' };
const NOME_ATV: Record<string, string> = {
  entrada: 'Entrou pelo portal',
  whatsapp: 'WhatsApp',
  ligacao: 'Ligação',
  visita: 'Visita',
  nota: 'Nota interna',
  simulacao: 'Simulação',
  sistema: 'Sistema',
  envio: 'Imóveis enviados',
  abriu: 'Abriu o link'
};
const minutos = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, '0')}` : `${Math.max(1, Math.round(s / 60))} min`);

export default function FichaPage() {
  const { id } = useParams<{ id: string }>();
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [d, setD] = useState<FichaContato | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [tarefa, setTarefa] = useState({ titulo: '', tipo: 'tarefa' as 'tarefa' | 'visita' | 'ligacao', quando: '' });
  const [todasPaginas, setTodasPaginas] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const [conversa, setConversa] = useState<Awaited<ReturnType<typeof conversaWhatsapp>> | null>(null);
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () => {
    conversaWhatsapp(id)
      .then(setConversa)
      .catch(() => {});
    return crmContato(id)
      .then(setD)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível abrir.'));
  };
  useEffect(() => {
    if (staff) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, id]);
  if (!loaded || !staff) return null;
  const gestor = veTudo(staff.role);
  if (erro) return <div className="p-8 text-sm text-red-700">{erro}</div>;
  if (!d) return <div className="p-8 text-sm text-[var(--text-muted)]">Carregando…</div>;
  const c = d.contato;
  const primeiro = c.nome.split(' ')[0];
  const wa = linkWhats(c.telefone, `Olá, ${primeiro}! Aqui é ${(staff.name || '').split(' ')[0]} da Mais Novos Imóveis.`);
  const aberto = d.negocios.find((n) => !['ganho', 'perdido'].includes(n.etapa));
  const p = d.contato.preferencias as { quartos?: number[]; valorMax?: number; bairros?: string[]; grupo?: string; alcance?: { raio: number; ref: string } };

  const registrar = async (tipo: 'nota' | 'whatsapp' | 'ligacao') => {
    // com a API ligada, a mensagem sai pelo número da empresa e fica na conversa
    if (tipo === 'whatsapp' && conversa?.api && texto.trim()) {
      const r = await enviarMensagemWhatsapp(c.id, texto);
      if (!r.ok) return setErro(r.erro ?? 'Não foi possível enviar.');
      setTexto('');
      return carregar();
    }
    if (tipo === 'whatsapp' && wa) window.open(texto.trim() ? linkWhats(c.telefone, texto)! : wa, '_blank');
    await registrarAtividade(c.id, tipo, texto || (tipo === 'whatsapp' ? 'Conversa pelo WhatsApp' : tipo === 'ligacao' ? 'Ligação' : '')).catch((e) => setErro(e.message));
    setTexto('');
    carregar();
  };

  const Pref = ({ k, v }: { k: string; v: string | null | undefined }) =>
    v ? (
      <div className="flex justify-between gap-3 border-t border-[var(--border)] py-1.5 text-[13px]">
        <span className="text-[var(--text-muted)]">{k}</span>
        <b className="text-right">{v}</b>
      </div>
    ) : null;
  const Num = ({ n, t }: { n: string | number; t: string }) => (
    <div className="rounded-xl bg-[var(--pill-bg)] px-2.5 py-2">
      <b className="block text-[16px] tabular-nums">{n}</b>
      <span className="text-[11px] text-[var(--text-muted)]">{t}</span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <PainelNav />
      <CrmNav ativo="/dashboard/crm/contatos" gestor={gestor} />
      {/* cabeçalho do contato */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-5 py-4 md:px-8">
        <Iniciais nome={c.nome} tam={48} />
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{c.nome}</h1>
          <div className="text-[12.5px] text-[var(--text-muted)]">
            {[c.telefone ? `+${c.telefone}` : null, c.email, c.corretor ? `com ${c.corretor}` : 'sem corretor', `desde ${dataHora(c.criadoEm)}`].filter(Boolean).join(' · ')}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <OrigemChip origem={c.tipo === 'corretor' ? 'corretor' : c.origem} />
            <CanalChip canal={c.canal} />
            <NotaChip nota={d.nota} comMotivo />
            {c.possivelCorretor && c.tipo !== 'corretor' && (
              <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[11.5px] font-bold text-[#B42318]">Possível corretor: {c.possivelCorretor}</span>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelecionando(true)} className="h-10 rounded-full bg-accent px-4 text-[13px] font-bold text-white">
            Selecionar imóveis
          </button>
          <Link href={`/dashboard/propostas/nova?contato=${c.id}`} className="flex h-10 items-center rounded-full border border-[var(--border)] px-3.5 text-[13px] font-semibold">
            Fazer proposta
          </Link>
          {c.tipo === 'corretor' ? (
            <button type="button" onClick={() => marcarTipo(c.id, 'cliente').then(carregar)} className="h-10 rounded-full border border-[var(--border)] px-3.5 text-[13px] font-semibold">
              Não é corretor
            </button>
          ) : (
            <button type="button" onClick={() => marcarTipo(c.id, 'corretor').then(carregar)} className="h-10 rounded-full border border-[var(--border)] px-3.5 text-[13px] font-semibold">
              É corretor
            </button>
          )}
          {d.podeTransferir && (
            <select
              aria-label="Corretor responsável"
              value={c.corretor ?? ''}
              onChange={(e) => e.target.value && atribuirContato(c.id, e.target.value).then(carregar)}
              className="h-10 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] font-semibold"
            >
              <option value="">Sem corretor</option>
              {d.corretores.map((x) => (
                <option key={x.email} value={x.email}>
                  {x.nome}
                </option>
              ))}
            </select>
          )}
          {c.telefone && (
            <a href={`tel:+${c.telefone}`} onClick={() => registrarAtividade(c.id, 'ligacao', 'Ligação').then(carregar)} className="flex h-10 items-center rounded-full border border-[var(--border)] px-3.5 text-[13px] font-semibold">
              Ligar
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener" onClick={() => registrarAtividade(c.id, 'whatsapp', 'Abriu o WhatsApp pelo CRM').then(carregar)} className="flex h-10 items-center rounded-full bg-[#25D366] px-4 text-[13px] font-bold text-[#08361A]">
              WhatsApp
            </a>
          )}
        </div>
      </div>

      <main className="grid gap-4 px-5 py-5 md:px-8 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        {/* esquerda */}
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <h2 className="mb-1 text-[14px] font-bold">O que procura</h2>
            <Pref k="Imóvel" v={p.grupo ?? null} />
            <Pref k="Quartos" v={p.quartos?.length ? p.quartos.map((q) => (q >= 4 ? '4+' : String(q))).join(', ') : null} />
            <Pref k="Até" v={p.valorMax ? brl(p.valorMax) : null} />
            <Pref k="Bairros" v={p.bairros?.join(', ')} />
            <Pref k="Avise-me" v={p.alcance ? `${p.alcance.raio > 0 ? `até ${p.alcance.raio >= 1000 ? `${p.alcance.raio / 1000} km` : `${p.alcance.raio} m`} de ` : 'só no '}${p.alcance.ref}` : null} />
            {!p.grupo && !p.quartos?.length && !p.valorMax && <p className="text-[12.5px] text-[var(--text-muted)]">Ainda não informado. Pergunte na conversa e anote.</p>}
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[14px] font-bold">No portal</h2>
              {d.portal.desde && <span className="text-[11.5px] text-[var(--text-muted)]">desde {dataHora(d.portal.desde)}</span>}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Num n={d.portal.paginas} t="páginas" />
              <Num n={d.portal.segundos ? minutos(d.portal.segundos) : '0'} t="no portal" />
              <Num n={d.portal.condominios} t="condomínios" />
              <Num n={d.portal.imoveis} t="anúncios" />
              <Num n={d.portal.simulacoes} t="simulações" />
              <Num n={d.portal.propostas} t="propostas" />
            </div>
            <h3 className="mt-3 text-[11.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Caminho (mais recente primeiro)</h3>
            {d.caminho.length === 0 && <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">Sem visitas ligadas a este contato (ele chegou direto pelo WhatsApp, ou de outro aparelho).</p>}
            <ol className="mt-1">
              {(todasPaginas ? d.caminho : d.caminho.slice(0, 10)).map((x, i) => (
                <li key={i} className="flex gap-2 py-1 text-[12.5px]">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${x.tipo === 'visita' ? 'bg-[#C9CDD3]' : 'bg-accent'}`} />
                  <a href={x.pagina} target="_blank" rel="noopener" className={`min-w-0 flex-1 hover:underline ${x.tipo !== 'visita' ? 'font-bold' : ''}`}>
                    {x.titulo}
                  </a>
                  <span className="whitespace-nowrap text-[var(--text-muted)]">{x.segundos ? minutos(x.segundos) : dataHora(x.quando)}</span>
                </li>
              ))}
            </ol>
            {d.caminho.length > 10 && (
              <button type="button" onClick={() => setTodasPaginas((v) => !v)} className="mt-1 text-[12.5px] font-semibold text-accent">
                {todasPaginas ? 'Mostrar menos' : `Ver tudo (${d.caminho.length})`}
              </button>
            )}
          </section>
        </div>

        {/* centro: linha do tempo */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
          {conversa && (conversa.api || conversa.mensagens.length > 0) && (
            <div className="border-b border-[var(--border)]">
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <h2 className="text-[14px] font-bold">Conversa no WhatsApp</h2>
                {conversa.iaLigada && (
                  <label className="ml-auto flex items-center gap-2 text-[12.5px] font-semibold">
                    <input
                      type="checkbox"
                      checked={conversa.iaAtiva}
                      onChange={(e) => ligarIaNoContato(c.id, e.target.checked).then(carregar)}
                      className="h-4 w-4 accent-[#3B3FB5]"
                    />
                    IA responde este contato
                  </label>
                )}
              </div>
              <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto bg-[#FAFAF7] px-4 py-3">
                {conversa.mensagens.length === 0 && <p className="text-[12.5px] text-[var(--text-muted)]">Nenhuma mensagem pelo número da empresa ainda.</p>}
                {conversa.mensagens.map((m) =>
                  m.direcao === 'entrada' ? (
                    <div key={m.id} className="max-w-[80%] self-start whitespace-pre-line rounded-2xl rounded-bl-sm border border-[var(--border)] bg-white px-3 py-2 text-[13.5px]">
                      {m.texto}
                      <div className="mt-1 text-[10.5px] text-[var(--text-muted)]">{dataHora(m.quando)}</div>
                    </div>
                  ) : (
                    <div key={m.id} className={`max-w-[80%] self-end whitespace-pre-line rounded-2xl rounded-br-sm px-3 py-2 text-[13.5px] ${m.autor === 'ia' ? 'bg-[#EEF2FF]' : 'bg-[#DCF8C6]'}`}>
                      {m.texto}
                      <div className="mt-1 text-right text-[10.5px] text-[var(--text-muted)]">
                        {m.autor === 'ia' ? <b className="text-[#3B3FB5]">IA</b> : m.autor.split('@')[0]} · {dataHora(m.quando)}
                        {m.status ? ` · ${m.status === 'read' ? 'lida' : m.status === 'delivered' ? 'entregue' : m.status.startsWith('erro') ? m.status : 'enviada'}` : ''}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-[14px] font-bold">Histórico</h2>
            <p className="text-[11.5px] text-[var(--text-muted)]">
              {conversa?.api ? 'Escreva abaixo e clique em "Enviar no WhatsApp": sai pelo número da empresa (e a IA pausa neste contato).' : 'Notas, ligações, envios e tudo o que a pessoa fez.'}
            </p>
          </div>
          <div className="border-b border-[var(--border)] p-3">
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Escreva uma nota, ou a mensagem para enviar no WhatsApp" className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-accent" />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => registrar('nota')} disabled={!texto.trim()} className="h-9 rounded-full border border-[var(--border)] px-3.5 text-[12.5px] font-semibold disabled:opacity-40">
                Salvar nota
              </button>
              <button type="button" onClick={() => registrar('ligacao')} className="h-9 rounded-full border border-[var(--border)] px-3.5 text-[12.5px] font-semibold">
                Registrar ligação
              </button>
              {wa && (
                <button type="button" onClick={() => registrar('whatsapp')} className="h-9 rounded-full bg-[#25D366] px-3.5 text-[12.5px] font-bold text-[#08361A]">
                  Enviar no WhatsApp
                </button>
              )}
            </div>
          </div>
          <ol className="flex-1 overflow-y-auto px-4 py-2">
            {d.atividades.map((a) => (
              <li key={a.id} className="flex gap-3 border-t border-[var(--border)] py-2.5 first:border-t-0">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${a.tipo === 'whatsapp' || a.tipo === 'abriu' ? 'bg-[#E7F9EE] text-[#0B6B33]' : a.tipo === 'envio' ? 'bg-[#EAF2FF] text-accent' : a.tipo === 'entrada' ? 'bg-[#EAF2FF] text-accent' : a.tipo === 'simulacao' ? 'bg-[#FFF4E5] text-[#8A4B00]' : 'bg-[var(--pill-bg)] text-[var(--text-muted)]'}`}>
                  {ICONE_ATV[a.tipo] ?? '•'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {NOME_ATV[a.tipo] ?? a.tipo} · {dataHora(a.quando)}
                    {a.autor ? ` · ${a.autor.split('@')[0]}` : ''}
                  </span>
                  {a.texto && <span className="block whitespace-pre-line text-[13.5px]">{a.texto}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* direita */}
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <h2 className="text-[14px] font-bold">Negócios</h2>
            {d.negocios.length === 0 && <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">Nenhum.</p>}
            {d.negocios.map((n) => (
              <div key={n.id} className="mt-2 rounded-xl border border-[var(--border)] p-3">
                <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{FUNIS.find((f) => f.id === n.funil)?.nome ?? n.funil}</div>
                <div className="text-[13.5px] font-semibold">{n.titulo ?? 'Sem título'}</div>
                {n.valor ? <div className="text-[12.5px] text-[var(--text-muted)]">{brl(n.valor)}</div> : null}
                <select
                  aria-label="Etapa"
                  value={n.etapa}
                  onChange={(e) => {
                    let motivo: string | undefined;
                    if (e.target.value === 'perdido') {
                      const m = window.prompt('Por que foi perdido? (opcional)');
                      if (m === null) return;
                      motivo = m;
                    }
                    moverNegocio(n.id, e.target.value, motivo).then(carregar);
                  }}
                  className="mt-2 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-[13px] font-semibold"
                >
                  {(d.etapas[n.funil] ?? []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                  <option value="ganho">Ganho</option>
                  <option value="perdido">Perdido</option>
                </select>
              </div>
            ))}
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold">Propostas ({d.propostas.length})</h2>
              <Link href={`/dashboard/propostas/nova?contato=${c.id}`} className="text-[12.5px] font-semibold text-accent">
                + Nova
              </Link>
            </div>
            {d.propostas.length === 0 && <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">Nenhuma proposta ainda.</p>}
            {d.propostas.map((p) => (
              <Link key={p.id} href={`/dashboard/propostas/${p.id}`} className="mt-2 block rounded-xl border border-[var(--border)] p-2.5 hover:border-accent">
                <span className="flex items-center justify-between gap-2">
                  <b className="text-[13px]">{p.numero ? `Nº ${numeroProposta(p.numero)}` : 'Proposta'}</b>
                  <span className="rounded-full bg-[var(--pill-bg)] px-2 py-0.5 text-[11px] font-semibold">{p.status ?? 'rascunho'}</span>
                </span>
                <span className="block truncate text-[12.5px] text-[var(--text-muted)]">{p.imovel}</span>
                <span className="block text-[12.5px] font-semibold">
                  {brl(p.valor)} · {dataHora(p.criadaEm)}
                </span>
              </Link>
            ))}
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <h2 className="text-[14px] font-bold">Tarefas</h2>
            {d.tarefas.map((t) => (
              <label key={t.id} className="flex items-start gap-2 border-t border-[var(--border)] py-2 first:border-t-0">
                <input type="checkbox" checked={t.feita} disabled={t.feita} onChange={() => concluirTarefa(t.id).then(carregar)} className="mt-0.5 h-4 w-4 accent-[#13874B]" />
                <span className={`flex-1 text-[13px] ${t.feita ? 'text-[var(--text-muted)] line-through' : 'font-semibold'}`}>
                  {t.tipo === 'visita' ? 'Visita: ' : t.tipo === 'ligacao' ? 'Ligar: ' : ''}
                  {t.titulo}
                </span>
                <span className="text-[11.5px] text-[var(--text-muted)]">{dataHora(t.venceEm)}</span>
              </label>
            ))}
            <div className="mt-2 flex flex-col gap-1.5">
              <input value={tarefa.titulo} onChange={(e) => setTarefa({ ...tarefa, titulo: e.target.value })} placeholder="Nova tarefa (ex.: enviar simulação)" className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 text-[13px] outline-none" />
              <div className="flex gap-1.5">
                <select value={tarefa.tipo} onChange={(e) => setTarefa({ ...tarefa, tipo: e.target.value as 'tarefa' })} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-[12.5px]">
                  <option value="tarefa">Tarefa</option>
                  <option value="ligacao">Ligação</option>
                  <option value="visita">Visita</option>
                </select>
                <input type="datetime-local" value={tarefa.quando} onChange={(e) => setTarefa({ ...tarefa, quando: e.target.value })} className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-[12.5px]" />
              </div>
              <button
                type="button"
                disabled={!tarefa.titulo.trim()}
                onClick={() =>
                  salvarTarefa(c.id, tarefa.titulo, tarefa.tipo, tarefa.quando ? new Date(tarefa.quando).toISOString() : null)
                    .then(() => {
                      setTarefa({ titulo: '', tipo: 'tarefa', quando: '' });
                      carregar();
                    })
                    .catch((e) => setErro(e.message))
                }
                className="h-9 rounded-full bg-accent text-[12.5px] font-bold text-white disabled:opacity-40"
              >
                Criar tarefa
              </button>
            </div>
          </section>
          {aberto && (
            <p className="text-[11.5px] text-[var(--text-muted)]">
              Negócio aberto há {tempoDesde(aberto.criadoEm).replace('há ', '')}.{' '}
              <Link href="/dashboard/crm/funil" className="font-semibold text-accent">
                Ver no funil
              </Link>
            </p>
          )}
        </div>
      </main>

      {/* imóveis enviados: o que foi mandado, se abriu, quanto tempo ficou na página */}
      <section className="mx-5 mb-8 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 md:mx-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold">Imóveis enviados ({d.envios.length})</h2>
          <button type="button" onClick={() => setSelecionando(true)} className="text-[13px] font-semibold text-accent">
            + Selecionar imóveis
          </button>
        </div>
        {d.envios.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Nada enviado ainda. Use "Selecionar imóveis": cada link avisa aqui quando ele abrir.</p>
        ) : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {d.envios.map((e) => {
              const caminho = (() => {
                try {
                  return new URL(e.destino).pathname;
                } catch {
                  return '';
                }
              })();
              const segundos = d.caminho.filter((x) => x.pagina === caminho).reduce((a, x) => Math.max(a, x.segundos), 0);
              return (
                <div key={e.id} className="flex gap-3 rounded-2xl border border-[var(--border)] p-2.5">
                  <span className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-[#DDE1E6]">
                    {e.capa && !e.privado && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.capa} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <a href={e.destino} target="_blank" rel="noopener" className="block truncate text-[13.5px] font-bold hover:underline">
                      {e.titulo}
                    </a>
                    <span className="block truncate text-[12px] text-[var(--text-muted)]">
                      {[e.preco ? brl(e.preco) : null, e.sub, e.privado ? 'privado' : null].filter(Boolean).join(' · ')}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      {e.aberturas > 0 ? (
                        <span className="rounded-full bg-[#E7F9EE] px-2 py-0.5 text-[11.5px] font-bold text-[#0B6B33]">
                          Abriu {e.aberturas}x · {tempoDesde(e.ultimoAberto)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[var(--pill-bg)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--text-muted)]">Ainda não abriu</span>
                      )}
                      {segundos > 0 && <span className="text-[11.5px] text-[var(--text-muted)]">ficou {minutos(segundos)} na página</span>}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[var(--text-faint)]">
                      enviado {dataHora(e.enviadoEm)}
                      {e.tipo === 'imovel' && (
                        <>
                          {' · '}
                          <Link href={`/dashboard/propostas/nova?contato=${c.id}&imovel=${e.refId}`} className="font-semibold text-accent">
                            fazer proposta
                          </Link>
                        </>
                      )}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selecionando && (
        <SelecionarImoveis
          contatoId={c.id}
          telefone={c.telefone}
          onClose={() => setSelecionando(false)}
          onEnviado={() => {
            setSelecionando(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}

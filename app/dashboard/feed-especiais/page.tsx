'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import PhotoUploadField from '@/components/PhotoUploadField';
import DepoimentoCard from '@/components/DepoimentoCard';
import DestaqueCard from '@/components/DestaqueCard';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import {
  listarDepoimentos,
  salvarDepoimento,
  excluirDepoimento,
  listarDestaques,
  salvarDestaque,
  excluirDestaque,
  type DepoimentoInput,
  type DestaqueInput
} from '@/lib/actions-especiais';
import type { Depoimento, Destaque } from '@/lib/especiais-tipos';

const input = 'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-accent';
const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]';

const depVazio: DepoimentoInput = { nome: '', subtitulo: '', texto: '', foto: null, nota: 5, ativo: true, ordem: 0 };
const destVazio: DestaqueInput = { selo: 'Destaque', titulo: '', texto: '', imagem: null, link: '', botao: 'Saiba mais', ativo: true, ordem: 0, inicio: '', fim: '' };

// Painel → Depoimentos e destaques: os dois cards especiais que entram no meio do feed.
export default function FeedEspeciaisPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [aba, setAba] = useState<'depoimentos' | 'destaques'>('depoimentos');
  const [deps, setDeps] = useState<Depoimento[]>([]);
  const [dests, setDests] = useState<Destaque[]>([]);
  const [dep, setDep] = useState<DepoimentoInput>(depVazio);
  const [dest, setDest] = useState<DestaqueInput>(destVazio);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (loaded && (!staff || !veTudo(staff.role))) router.replace(staff ? '/dashboard' : '/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () => {
    listarDepoimentos().then(setDeps).catch(() => {});
    listarDestaques().then(setDests).catch(() => {});
  };
  useEffect(() => {
    if (staff && veTudo(staff.role)) carregar();
  }, [staff]);

  if (!loaded || !staff || !veTudo(staff.role)) return null;

  const salvarDep = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await salvarDepoimento(dep);
    setMsg(r.ok ? { ok: true, t: dep.id ? 'Depoimento atualizado.' : 'Depoimento publicado. Ele já aparece no feed.' } : { ok: false, t: r.erro ?? 'Não foi possível salvar.' });
    if (r.ok) {
      setDep(depVazio);
      carregar();
    }
  };
  const salvarDest = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await salvarDestaque(dest);
    setMsg(r.ok ? { ok: true, t: dest.id ? 'Destaque atualizado.' : 'Destaque publicado. Ele já aparece no feed.' } : { ok: false, t: r.erro ?? 'Não foi possível salvar.' });
    if (r.ok) {
      setDest(destVazio);
      carregar();
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Depoimentos e destaques</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
          Cards especiais que entram no meio do feed: no máximo um depoimento e um destaque a cada 24 imóveis. Cada depoimento aparece uma vez por visita; os
          destaques se revezam. Desmarque &quot;Ativo&quot; para tirar do ar sem apagar.
        </p>

        <div className="mt-5 flex gap-2">
          {(['depoimentos', 'destaques'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAba(a);
                setMsg(null);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${aba === a ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
            >
              {a === 'depoimentos' ? `Depoimentos (${deps.length})` : `Destaques (${dests.length})`}
            </button>
          ))}
        </div>

        {msg && <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}

        {aba === 'depoimentos' ? (
          <div className="mt-6 grid gap-8 md:grid-cols-[1fr_300px]">
            <form onSubmit={salvarDep} className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">{dep.id ? 'Editar depoimento' : 'Novo depoimento'}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className={label}>Nome do cliente *</span>
                  <input className={input} value={dep.nome} onChange={(e) => setDep({ ...dep, nome: e.target.value })} placeholder="Ex.: Ana e Marcos" maxLength={80} />
                </div>
                <div>
                  <span className={label}>Linha de apoio</span>
                  <input
                    className={input}
                    value={dep.subtitulo ?? ''}
                    onChange={(e) => setDep({ ...dep, subtitulo: e.target.value })}
                    placeholder="Ex.: Compraram um apartamento no Setor Bueno"
                    maxLength={120}
                  />
                </div>
              </div>
              <div>
                <span className={label}>Depoimento * ({(dep.texto ?? '').length}/700)</span>
                <textarea className={`${input} min-h-[130px]`} value={dep.texto} onChange={(e) => setDep({ ...dep, texto: e.target.value })} maxLength={700} />
                <p className="mt-1 text-xs text-[var(--text-faint)]">Use as palavras do cliente e publique só com a autorização dele (nome e foto).</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <span className={label}>Estrelas</span>
                  <select className={input} value={dep.nota ?? 0} onChange={(e) => setDep({ ...dep, nota: Number(e.target.value) || null })}>
                    <option value={0}>Sem estrelas</option>
                    {[5, 4, 3].map((n) => (
                      <option key={n} value={n}>
                        {n} estrelas
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={label}>Ordem</span>
                  <input type="number" className={input} value={dep.ordem ?? 0} onChange={(e) => setDep({ ...dep, ordem: Number(e.target.value) })} />
                </div>
                <label className="flex items-end gap-2 pb-2.5 text-sm font-semibold">
                  <input type="checkbox" checked={dep.ativo} onChange={(e) => setDep({ ...dep, ativo: e.target.checked })} /> Ativo
                </label>
              </div>
              <PhotoUploadField
                photos={dep.foto ? [dep.foto] : []}
                onChange={(u) => setDep({ ...dep, foto: u[u.length - 1] ?? null })}
                onUploadingChange={setEnviando}
                folder="site"
                label="Foto do cliente (opcional)"
                compacto
                nomeArquivo={`depoimento ${dep.nome}`}
              />
              <div className="flex gap-2">
                <button disabled={enviando} className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {dep.id ? 'Salvar alterações' : 'Publicar depoimento'}
                </button>
                {dep.id && (
                  <button type="button" onClick={() => setDep(depVazio)} className="rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-[var(--pill-bg)]">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
            <div>
              <span className={label}>Prévia no feed</span>
              <DepoimentoCard
                d={{ id: 'previa', nome: dep.nome || 'Nome do cliente', subtitulo: dep.subtitulo || null, texto: dep.texto || 'O texto do depoimento aparece aqui.', foto: dep.foto ?? null, nota: dep.nota ?? null }}
              />
            </div>
            <section className="md:col-span-2">
              <h2 className="text-lg font-bold">Cadastrados</h2>
              {deps.length === 0 && <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum depoimento ainda.</p>}
              <div className="mt-3 flex flex-col gap-2">
                {deps.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] p-3">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${d.ativo ? 'bg-green-100 text-green-800' : 'bg-[var(--pill-bg)] text-[var(--text-muted)]'}`}>
                      {d.ativo ? 'Ativo' : 'Fora do ar'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-bold">{d.nome}</span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">{d.texto}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDep({ id: d.id, nome: d.nome, subtitulo: d.subtitulo ?? '', texto: d.texto, foto: d.foto, nota: d.nota, ativo: d.ativo, ordem: d.ordem });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-[var(--pill-bg)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Apagar o depoimento de ${d.nome}?`)) return;
                        await excluirDepoimento(d.id);
                        carregar();
                      }}
                      className="rounded-full px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Apagar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-6 grid gap-8 md:grid-cols-[1fr_300px]">
            <form onSubmit={salvarDest} className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">{dest.id ? 'Editar destaque' : 'Novo destaque'}</h2>
              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                <div>
                  <span className={label}>Barrinha</span>
                  <input className={input} value={dest.selo ?? ''} onChange={(e) => setDest({ ...dest, selo: e.target.value })} placeholder="Destaque" maxLength={24} />
                </div>
                <div>
                  <span className={label}>Título *</span>
                  <input
                    className={input}
                    value={dest.titulo}
                    onChange={(e) => setDest({ ...dest, titulo: e.target.value })}
                    placeholder="Ex.: Crédito com garantia de imóvel em até 240 meses"
                    maxLength={90}
                  />
                </div>
              </div>
              <div>
                <span className={label}>Texto ({(dest.texto ?? '').length}/300)</span>
                <textarea className={`${input} min-h-[90px]`} value={dest.texto ?? ''} onChange={(e) => setDest({ ...dest, texto: e.target.value })} maxLength={300} />
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <div>
                  <span className={label}>Link do botão</span>
                  <input
                    className={input}
                    value={dest.link ?? ''}
                    onChange={(e) => setDest({ ...dest, link: e.target.value })}
                    placeholder="/financiamento, /imovel/… ou https://…"
                  />
                </div>
                <div>
                  <span className={label}>Texto do botão</span>
                  <input className={input} value={dest.botao ?? ''} onChange={(e) => setDest({ ...dest, botao: e.target.value })} placeholder="Saiba mais" maxLength={30} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <span className={label}>Início</span>
                  <input type="date" className={input} value={dest.inicio ?? ''} onChange={(e) => setDest({ ...dest, inicio: e.target.value })} />
                </div>
                <div>
                  <span className={label}>Fim</span>
                  <input type="date" className={input} value={dest.fim ?? ''} onChange={(e) => setDest({ ...dest, fim: e.target.value })} />
                </div>
                <div>
                  <span className={label}>Ordem</span>
                  <input type="number" className={input} value={dest.ordem ?? 0} onChange={(e) => setDest({ ...dest, ordem: Number(e.target.value) })} />
                </div>
                <label className="flex items-end gap-2 pb-2.5 text-sm font-semibold">
                  <input type="checkbox" checked={dest.ativo} onChange={(e) => setDest({ ...dest, ativo: e.target.checked })} /> Ativo
                </label>
              </div>
              <PhotoUploadField
                photos={dest.imagem ? [dest.imagem] : []}
                onChange={(u) => setDest({ ...dest, imagem: u[u.length - 1] ?? null })}
                onUploadingChange={setEnviando}
                folder="site"
                label="Imagem (opcional)"
                compacto
                nomeArquivo={dest.titulo || 'destaque'}
              />
              <div className="flex gap-2">
                <button disabled={enviando} className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {dest.id ? 'Salvar alterações' : 'Publicar destaque'}
                </button>
                {dest.id && (
                  <button type="button" onClick={() => setDest(destVazio)} className="rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-[var(--pill-bg)]">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
            <div>
              <span className={label}>Prévia no feed</span>
              <DestaqueCard
                d={{
                  id: 'previa',
                  selo: dest.selo || 'Destaque',
                  titulo: dest.titulo || 'Título do destaque',
                  texto: dest.texto || null,
                  imagem: dest.imagem ?? null,
                  link: null,
                  botao: dest.botao || null
                }}
              />
            </div>
            <section className="md:col-span-2">
              <h2 className="text-lg font-bold">Cadastrados</h2>
              {dests.length === 0 && <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum destaque ainda.</p>}
              <div className="mt-3 flex flex-col gap-2">
                {dests.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] p-3">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${d.ativo ? 'bg-green-100 text-green-800' : 'bg-[var(--pill-bg)] text-[var(--text-muted)]'}`}>
                      {d.ativo ? 'Ativo' : 'Fora do ar'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-bold">{d.titulo}</span>
                      <span className="block text-xs text-[var(--text-muted)]">
                        {d.exibicoes.toLocaleString('pt-BR')} exibições · {d.cliques.toLocaleString('pt-BR')} cliques
                        {d.fim ? ` · até ${d.fim.split('-').reverse().join('/')}` : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDest({
                          id: d.id,
                          selo: d.selo,
                          titulo: d.titulo,
                          texto: d.texto ?? '',
                          imagem: d.imagem,
                          link: d.link ?? '',
                          botao: d.botao ?? '',
                          ativo: d.ativo,
                          ordem: d.ordem,
                          inicio: d.inicio ?? '',
                          fim: d.fim ?? ''
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-[var(--pill-bg)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Apagar o destaque "${d.titulo}"?`)) return;
                        await excluirDestaque(d.id);
                        carregar();
                      }}
                      className="rounded-full px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Apagar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

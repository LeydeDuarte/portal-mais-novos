'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { juntarCondominios, listarDuplicados, marcarDiferentes, type GrupoDup } from '@/lib/duplicados';

// Possíveis condomínios duplicados, lado a lado: o admin/analista confirma se é o
// mesmo (junta num só) ou se são diferentes (não aparece mais aqui).
export default function DuplicadosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [dados, setDados] = useState<{ grupos: GrupoDup[]; total: number; provaveis: number } | null>(null);
  const [principal, setPrincipal] = useState<Record<string, string>>({});
  const [juntar, setJuntar] = useState<Record<string, string[]>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loaded && (!staff || !veTudo(staff.role))) router.replace(staff ? '/dashboard/condominios' : '/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () =>
    listarDuplicados()
      .then((d) => {
        setDados(d);
        // sugestão: fica o que tem mais anúncios/fotos; os demais já vêm marcados para juntar
        const pr: Record<string, string> = {};
        const jn: Record<string, string[]> = {};
        for (const g of d.grupos) {
          const melhor = [...g.itens].sort((a, b) => b.anuncios - a.anuncios || b.fotos - a.fotos || Number(b.status === 'publicado') - Number(a.status === 'publicado'))[0];
          pr[g.chave] = melhor.id;
          jn[g.chave] = g.provavel ? g.itens.filter((i) => i.id !== melhor.id).map((i) => i.id) : [];
        }
        setPrincipal(pr);
        setJuntar(jn);
      })
      .catch(() => setDados({ grupos: [], total: 0, provaveis: 0 }));
  useEffect(() => {
    if (staff && veTudo(staff.role)) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  if (!loaded || !staff || !veTudo(staff.role)) return null;

  const confirmarJuntar = async (g: GrupoDup) => {
    const alvo = principal[g.chave];
    const outros = (juntar[g.chave] ?? []).filter((id) => id !== alvo);
    if (!outros.length) return setMsg('Marque qual(is) condomínio(s) é(são) o mesmo que o principal.');
    const nome = g.itens.find((i) => i.id === alvo)?.name;
    if (!window.confirm(`Juntar ${outros.length} cadastro(s) em "${nome}"? Os anúncios passam para ele e os outros cadastros deixam de existir.`)) return;
    setOcupado(g.chave);
    const r = await juntarCondominios(alvo, outros);
    setOcupado(null);
    setMsg(r.ok ? `Pronto, juntados em ${nome}.` : r.erro ?? 'Falhou.');
    carregar();
  };
  const confirmarDiferentes = async (g: GrupoDup) => {
    setOcupado(g.chave);
    await marcarDiferentes(g.itens.map((i) => i.id));
    setOcupado(null);
    setMsg('Marcados como condomínios diferentes, não aparecem mais aqui.');
    carregar();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <Link href="/dashboard/condominios" className="text-sm font-semibold text-[var(--text-muted)] hover:underline">
          ← Condomínios
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-semibold">Possíveis condomínios duplicados</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Mesmo nome na mesma cidade. Confira lado a lado: se for o <strong>mesmo condomínio</strong>, escolha qual cadastro fica (o principal) e junte, os
          anúncios, tipologias e interessados passam para ele, e o que estiver vazio nele é completado com os dados do outro. Se forem{' '}
          <strong>prédios diferentes</strong> (ex.: mesmo nome em bairros diferentes), marque &quot;São diferentes&quot;.
        </p>
        {dados && (
          <p className="mt-3 text-sm">
            <strong>{dados.total}</strong> grupo(s) para conferir · <strong>{dados.provaveis}</strong> com mesmo bairro ou CEP (mais prováveis, aparecem primeiro)
            {dados.total > dados.grupos.length && ` · mostrando os ${dados.grupos.length} primeiros`}
          </p>
        )}
        {msg && <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{msg}</p>}
        {!dados && <p className="mt-6 text-sm text-[var(--text-muted)]">Procurando…</p>}
        {dados && dados.grupos.length === 0 && <p className="mt-6 text-sm text-[var(--text-muted)]">Nenhum possível duplicado. Tudo certo!</p>}

        <div className="mt-5 flex flex-col gap-5">
          {dados?.grupos.map((g) => (
            <section key={g.chave} className="rounded-2xl border border-[var(--border)] p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${g.provavel ? 'bg-[#e62f2f] text-white' : 'bg-[var(--pill-bg)]'}`}>
                  {g.provavel ? 'Provável duplicado' : 'Mesmo nome'}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.itens.map((c) => {
                  const ehPrincipal = principal[g.chave] === c.id;
                  const marcado = (juntar[g.chave] ?? []).includes(c.id);
                  return (
                    <div key={c.id} className={`flex flex-col gap-1.5 rounded-xl border p-3 text-sm ${ehPrincipal ? 'border-accent ring-1 ring-accent' : 'border-[var(--border)]'}`}>
                      <div className="h-24 overflow-hidden rounded-lg bg-[var(--card-img-bg)]">
                        {c.capa ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.capa} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-[var(--text-faint)]">sem foto</div>
                        )}
                      </div>
                      <div className="font-bold">{c.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {[c.logradouro, c.bairro, c.cidade].filter(Boolean).join(' · ') || 'sem endereço'}
                        {c.cep ? ` · CEP ${c.cep}` : ''}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {c.anuncios} anúncio(s) · {c.fotos} foto(s) · entrega {c.entrega ?? '-'} · {c.status}
                        {c.jetimob ? ' · Jetimob' : c.origem ? ` · ${c.origem}` : ''}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold">
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            name={`p-${g.chave}`}
                            checked={ehPrincipal}
                            onChange={() => {
                              setPrincipal({ ...principal, [g.chave]: c.id });
                              setJuntar({ ...juntar, [g.chave]: (juntar[g.chave] ?? []).filter((x) => x !== c.id) });
                            }}
                          />
                          Fica este
                        </label>
                        {!ehPrincipal && (
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={(e) =>
                                setJuntar({
                                  ...juntar,
                                  [g.chave]: e.target.checked ? [...(juntar[g.chave] ?? []), c.id] : (juntar[g.chave] ?? []).filter((x) => x !== c.id)
                                })
                              }
                            />
                            É o mesmo
                          </label>
                        )}
                        <a href={`/dashboard/condominios/${c.id}/editar`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                          abrir
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={ocupado === g.chave}
                  onClick={() => confirmarJuntar(g)}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  Juntar os marcados
                </button>
                <button
                  type="button"
                  disabled={ocupado === g.chave}
                  onClick={() => confirmarDiferentes(g)}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold hover:bg-[var(--pill-bg)] disabled:opacity-50"
                >
                  São diferentes
                </button>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

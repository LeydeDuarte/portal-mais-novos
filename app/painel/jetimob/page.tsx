'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { finalizarSync, importarContatosJetimob, iniciarSync, statusJetimob, syncCondominiosPagina, syncFotos, syncImoveisPagina, testarJetimob } from '@/lib/jetimob-actions';

type Status = Awaited<ReturnType<typeof statusJetimob>>;
type Teste = Awaited<ReturnType<typeof testarJetimob>>;

export default function JetimobPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [st, setSt] = useState<Status | null>(null);
  const [teste, setTeste] = useState<Teste | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [rodando, setRodando] = useState(false);
  const [trocarFotos, setTrocarFotos] = useState(false);
  const parar = useRef(false);

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);
  const carregar = () => statusJetimob().then(setSt).catch(() => {});
  useEffect(() => {
    if (staff) carregar();
  }, [staff]);

  const add = (m: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString('pt-BR')} — ${m}`]);

  const testar = async () => {
    setTeste(null);
    setTeste(await testarJetimob());
  };

  // Sincronização completa: condomínios → imóveis → tira do ar o que saiu da Jetimob → fotos
  const sincronizar = async (soFotos = false) => {
    setRodando(true);
    parar.current = false;
    setLog([]);
    const resumo = { condominiosNovos: 0, condominiosAtualizados: 0, condominiosVinculados: 0, imoveisNovos: 0, imoveisAtualizados: 0, fotos: 0 };
    try {
      if (!soFotos) {
        const s = await iniciarSync('completa');
        if (trocarFotos) add('Trocando TODAS as fotos: serão baixadas de novo da Jetimob (as atuais continuam no ar até as novas chegarem).');
        let p = 1;
        let total = 1;
        do {
          const r = await syncCondominiosPagina(p, trocarFotos);
          total = r.totalPaginas || 1;
          resumo.condominiosNovos += r.criados;
          resumo.condominiosAtualizados += r.atualizados;
          resumo.condominiosVinculados += r.vinculados;
          add(`Condomínios — página ${p} de ${total}: ${r.criados} novo(s), ${r.atualizados} atualizado(s)${r.vinculados ? `, ${r.vinculados} ligado(s) a condomínios que já existiam` : ''}${r.erros.length ? ` · ${r.erros.length} erro(s)` : ''}`);
          r.erros.slice(0, 3).forEach((e) => add(`  ⚠ ${e}`));
          p++;
        } while (p <= total && !parar.current);
        p = 1;
        total = 1;
        do {
          const r = await syncImoveisPagina(p, trocarFotos);
          total = r.totalPaginas || 1;
          resumo.imoveisNovos += r.criados;
          resumo.imoveisAtualizados += r.atualizados;
          add(`Imóveis — página ${p} de ${total}: ${r.criados} novo(s), ${r.atualizados} atualizado(s)${r.erros.length ? ` · ${r.erros.length} erro(s)` : ''}`);
          r.erros.slice(0, 3).forEach((e) => add(`  ⚠ ${e}`));
          p++;
        } while (p <= total && !parar.current);
        await finalizarSync(s.id, resumo);
      }
      add('Baixando as fotos da Jetimob para o nosso armazenamento…');
      for (let i = 0; i < 400 && !parar.current; i++) {
        const f = await syncFotos();
        resumo.fotos += f.enviadas;
        add(`Fotos: +${f.enviadas} (faltam ${f.restantes})${f.erros.length ? ` · ${f.erros[0]}` : ''}`);
        if (!f.restantes || (!f.enviadas && f.erros.length)) break;
      }
      add(parar.current ? 'Interrompido — dá para continuar depois.' : 'Pronto!');
    } catch (e) {
      add(`Erro: ${e instanceof Error ? e.message : 'falha'}`);
    }
    setRodando(false);
    carregar();
  };

  if (!loaded || !staff) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Migração da Jetimob</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Traz <strong>uma vez</strong> tudo o que está na Jetimob para o portal — condomínios, imóveis, fotos, plantas e contatos. Depois disso o portal passa a ser a
          fonte: rodar de novo só acrescenta o que ainda não veio, <strong>nunca apaga nem sobrescreve</strong> o que foi editado aqui. Imóveis publicados no site da
          Jetimob entram como <strong>públicos</strong>; os demais, como <strong>privados</strong>. Condomínios que já existem aqui (inclusive os da planilha) são
          ligados, não duplicados.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          <li>Testar conexão</li>
          <li>Importar tudo (condomínios → imóveis → fotos)</li>
          <li>Importar contatos (leads do CRM → Interessados)</li>
          <li>
            Só cancele a Jetimob quando <strong>Fotos na fila = 0</strong> — as fotos ficam hospedadas na Jetimob até serem copiadas para cá.
          </li>
        </ol>

        {st && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Imóveis da Jetimob', st.contagem.imoveis],
              ['…sendo privados', st.contagem.privados],
              ['Condomínios ligados', st.contagem.condominios],
              ['Fotos na fila (aguardar 0)', st.contagem.fotosPendentes]
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[var(--border)] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{k}</div>
                <div className="font-sans text-2xl font-bold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
        )}
        {st && !st.configurado && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">A chave da Jetimob ainda não está no ar (variável JETIMOB_WEBSERVICE_KEY na Vercel + novo deploy).</p>
        )}

        <label className="mt-5 flex items-start gap-2 rounded-xl border border-[var(--border)] p-3 text-sm">
          <input type="checkbox" className="mt-0.5" checked={trocarFotos} onChange={(e) => setTrocarFotos(e.target.checked)} disabled={rodando} />
          <span>
            <strong>Trocar todas as fotos</strong> — baixa de novo todas as fotos e plantas da Jetimob e substitui as que já vieram (use depois de tirar a marca
            d&apos;água na Jetimob). As fotos atuais ficam no ar até as novas terminarem de chegar.
          </span>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={testar} disabled={rodando} className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-bold hover:bg-[var(--pill-bg)] disabled:opacity-50">
            Testar conexão
          </button>
          <button type="button" onClick={() => sincronizar(false)} disabled={rodando} className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
            {rodando ? 'Importando…' : 'Importar tudo'}
          </button>
          <button type="button" onClick={() => sincronizar(true)} disabled={rodando} className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-bold hover:bg-[var(--pill-bg)] disabled:opacity-50">
            Só baixar fotos pendentes
          </button>
          <button
            type="button"
            onClick={async () => {
              add('Importando contatos (leads) da Jetimob…');
              const r = await importarContatosJetimob();
              add(r.ok ? `Contatos: ${r.importados} importado(s), ${r.jaExistiam} já estavam aqui (de ${r.total}). Estão em Painel → Interessados.` : `Contatos: ${r.erro}`);
            }}
            disabled={rodando}
            className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-bold hover:bg-[var(--pill-bg)] disabled:opacity-50"
          >
            Importar contatos
          </button>
          {rodando && (
            <button type="button" onClick={() => (parar.current = true)} className="rounded-full px-4 py-2.5 text-sm font-bold text-red-600 hover:underline">
              Parar
            </button>
          )}
        </div>

        {teste && (
          <div className={`mt-4 rounded-2xl border p-4 text-sm ${teste.ok ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
            {teste.ok ? (
              <>
                <strong>Conectado!</strong> A Jetimob tem {teste.condominios} condomínio(s), {teste.imoveis} imóvel(is) disponível(is) no sistema e {teste.ativos} publicado(s) no site.
                {teste.exemplo && (
                  <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    {Object.entries(teste.exemplo).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-[var(--text-muted)]">{k}:</span> <strong>{String(v ?? '—')}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <strong>Não conectou:</strong> {teste.erro}
              </>
            )}
          </div>
        )}

        {log.length > 0 && (
          <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-[var(--pill-bg)] p-4 text-xs leading-relaxed">{log.join('\n')}</pre>
        )}

        {st && st.ultimas.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Importações feitas</h2>
            <ul className="mt-2 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] text-sm">
              {st.ultimas.map((u, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span>
                    <strong>Importação</strong> · {new Date(u.iniciado).toLocaleString('pt-BR')}
                    {!u.terminado && <span className="ml-2 text-amber-700">(não terminou)</span>}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {u.erro
                      ? `erro: ${u.erro}`
                      : Object.entries(u.resumo)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[var(--text-faint)]">Não há sincronização automática — a Jetimob vai ser desligada; depois da migração, tudo é editado aqui no portal.</p>
          </section>
        )}
      </main>
    </div>
  );
}

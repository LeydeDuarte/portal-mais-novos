'use client';

// Painel → Importar imagens em massa. Uma pasta principal com uma subpasta por empreendimento
// (fotos, perspectivas, plantas e PDFs misturados). O navegador reduz as imagens e recorta as
// páginas dos PDFs; o portal classifica com IA, guarda, liga as plantas e escolhe a capa.
import { useRef, useState } from 'react';
import Link from 'next/link';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { casarPastas, criarRascunhoDaPasta, fecharPasta, pendenciasImportacao, type Casamento, type Pendencia } from '@/lib/actions-importar-massa';
import { contarPaginas, renderizarPaginas } from '@/lib/pdf-import/extract';

type Pasta = Casamento & { arquivos: File[]; destino: string; contagem: Record<string, number>; estado: 'esperando' | 'rodando' | 'feita' | 'pulada' };
const IMAGEM = /\.(jpe?g|png|webp)$/i;
const PDF = /\.pdf$/i;
const MAX_PAGINAS_PDF = 80;

async function sha1(dados: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', dados);
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function reduzir(arquivo: Blob, maior = 2400): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo).catch(() => null);
  if (!bmp) throw new Error('imagem não abre (HEIC não é aceito)');
  const esc = Math.min(1, maior / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * esc);
  c.height = Math.round(bmp.height * esc);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const b = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.86));
  if (!b) throw new Error('falha ao reduzir');
  return b;
}

async function enviar(devId: string, blob: Blob, hash: string, nome: string): Promise<string> {
  const f = new FormData();
  f.append('arquivo', blob, 'img.jpg');
  f.append('devId', devId);
  f.append('hash', hash);
  f.append('nome', nome);
  for (let t = 0; t < 3; t++) {
    const r = await fetch('/api/importar-massa', { method: 'POST', body: f }).catch(() => null);
    const j = r ? ((await r.json().catch(() => ({}))) as { situacao?: string; erro?: string }) : { erro: 'sem conexão' };
    if (r?.ok && j.situacao) return j.situacao;
    if (r && r.status < 500 && r.status !== 429) throw new Error(j.erro ?? `HTTP ${r.status}`);
    await new Promise((ok) => setTimeout(ok, 2000 * (t + 1)));
  }
  throw new Error('falhou 3 vezes');
}

const ROTULO: Record<string, string> = { foto: 'fotos', planta: 'plantas', planta_sem_par: 'plantas sem par', descartada: 'descartadas', repetida: 'já importadas', erro: 'erros' };

export default function ImportarImagensPage() {
  const { staff, loaded } = useStaffSession();
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [lendo, setLendo] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pend, setPend] = useState<Pendencia[] | null>(null);
  const parar = useRef(false);

  if (!loaded) return <PainelNav />;
  if (!staff || !veTudo(staff.role))
    return (
      <div className="min-h-screen">
        <PainelNav />
        <p className="p-8 text-sm">Só administrador ou analista.</p>
      </div>
    );

  const escolher = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setLendo(true);
    setMsg(null);
    const grupos = new Map<string, File[]>();
    let ignorados = 0;
    for (const f of Array.from(lista)) {
      if (!IMAGEM.test(f.name) && !PDF.test(f.name)) {
        ignorados++;
        continue;
      }
      const partes = (f.webkitRelativePath || f.name).split('/');
      const pasta = partes.length > 2 ? partes[1] : partes[0];
      if (!grupos.has(pasta)) grupos.set(pasta, []);
      grupos.get(pasta)!.push(f);
    }
    const nomes = Array.from(grupos.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const res: Casamento[] = [];
    for (let i = 0; i < nomes.length; i += 100) res.push(...(await casarPastas(nomes.slice(i, i + 100))));
    setPastas(
      res.map((c) => ({
        ...c,
        arquivos: grupos.get(c.pasta) ?? [],
        // com certeza → liga; sem nenhum parecido → cria rascunho; dúvida → você escolhe (fica "pular")
        destino: c.escolhido ? c.escolhido.id : c.opcoes.length ? 'pular' : 'criar',
        contagem: {},
        estado: 'esperando'
      }))
    );
    setLendo(false);
    if (ignorados) setMsg(`${ignorados} arquivo(s) ignorado(s) (só JPG, PNG, WEBP e PDF).`);
  };

  const rodar = async () => {
    parar.current = false;
    setRodando(true);
    for (let i = 0; i < pastas.length; i++) {
      if (parar.current) break;
      const p = pastas[i];
      if (p.estado === 'feita' || p.destino === 'pular') {
        if (p.destino === 'pular') setPastas((xs) => xs.map((x, k) => (k === i ? { ...x, estado: 'pulada' } : x)));
        continue;
      }
      setPastas((xs) => xs.map((x, k) => (k === i ? { ...x, estado: 'rodando' } : x)));
      let devId = p.destino;
      try {
        if (devId === 'criar') {
          const novo = await criarRascunhoDaPasta(p.pasta);
          devId = novo.id;
          setPastas((xs) => xs.map((x, k) => (k === i ? { ...x, destino: novo.id, escolhido: novo, opcoes: [novo, ...x.opcoes] } : x)));
        }
      } catch (e) {
        setMsg(`Não consegui criar "${p.pasta}": ${e instanceof Error ? e.message : 'erro'}`);
        continue;
      }
      const conta = (s: string) =>
        setPastas((xs) => xs.map((x, k) => (k === i ? { ...x, contagem: { ...x.contagem, [s]: (x.contagem[s] ?? 0) + 1 } } : x)));
      // tarefas: cada imagem e cada página de PDF
      const tarefas: (() => Promise<void>)[] = [];
      for (const f of p.arquivos) {
        if (IMAGEM.test(f.name)) {
          tarefas.push(async () => {
            const hash = await sha1(await f.arrayBuffer());
            const blob = await reduzir(f);
            conta(await enviar(devId, blob, hash, f.name));
          });
        } else {
          tarefas.push(async () => {
            const bytes = await f.arrayBuffer();
            const base = await sha1(bytes);
            const n = Math.min(MAX_PAGINAS_PDF, await contarPaginas(f));
            const paginas = Array.from({ length: n }, (_, k) => k + 1);
            const blobs = await renderizarPaginas(f, paginas, undefined, 2000);
            for (const [k, b] of blobs.entries()) {
              if (parar.current) return;
              const hash = await sha1(new TextEncoder().encode(`${base}:${k + 1}`).buffer as ArrayBuffer);
              try {
                conta(await enviar(devId, b, hash, `${f.name} p.${k + 1}`));
              } catch {
                conta('erro');
              }
            }
          });
        }
      }
      // 3 envios ao mesmo tempo
      let prox = 0;
      await Promise.all(
        Array.from({ length: 3 }, async () => {
          while (prox < tarefas.length && !parar.current) {
            const t = tarefas[prox++];
            try {
              await t();
            } catch {
              conta('erro');
            }
          }
        })
      );
      await fecharPasta(devId).catch(() => null);
      setPastas((xs) => xs.map((x, k) => (k === i ? { ...x, estado: parar.current ? 'esperando' : 'feita' } : x)));
    }
    setRodando(false);
    setPend(await pendenciasImportacao().catch(() => []));
  };

  const total = pastas.reduce((a, p) => a + p.arquivos.length, 0);
  const feitas = pastas.filter((p) => p.estado === 'feita').length;
  const duvidas = pastas.filter((p) => !p.escolhido && p.opcoes.length && p.destino === 'pular').length;

  return (
    <div className="min-h-screen">
      <PainelNav />
      <main className="mx-auto w-full max-w-6xl px-5 py-6 md:px-8">
        <h1 className="text-2xl font-bold">Importar imagens em massa</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
          Escolha a pasta principal: dentro dela, uma subpasta para cada empreendimento, com o nome dele (pode ter &quot; - Bairro&quot; no fim). Pode
          misturar fotos, perspectivas, plantas e PDFs (book, caderno de plantas). A IA separa foto de planta, descarta logos, mapas e tabelas, liga
          cada planta à tipologia de mesma metragem e escolhe a capa. Arquivos já importados são pulados: pode parar e continuar depois.
        </p>

        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white">
          {lendo ? 'Lendo a pasta…' : 'Escolher a pasta principal'}
          <input
            type="file"
            multiple
            className="hidden"
            // @ts-expect-error atributo de pasta do navegador
            webkitdirectory=""
            onChange={(e) => escolher(e.target.files)}
            disabled={lendo || rodando}
          />
        </label>
        {msg && <p className="mt-3 text-sm text-amber-700">{msg}</p>}

        {pastas.length > 0 && (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] p-4 text-sm">
              <b>{pastas.length} pastas</b> · {total} arquivos · {feitas} feitas
              {duvidas > 0 && <span className="rounded-full bg-[#FFF4D6] px-2.5 py-0.5 font-semibold text-[#8A5A00]">{duvidas} para você escolher o condomínio</span>}
              <span className="ml-auto flex gap-2">
                {!rodando ? (
                  <button type="button" onClick={rodar} className="rounded-full bg-accent px-5 py-2 font-bold text-white">
                    {feitas ? 'Continuar' : 'Começar'}
                  </button>
                ) : (
                  <button type="button" onClick={() => (parar.current = true)} className="rounded-full border border-[var(--border)] px-5 py-2 font-semibold">
                    Pausar
                  </button>
                )}
              </span>
            </div>
            {rodando && <p className="mt-2 text-xs text-[var(--text-muted)]">Deixe esta aba aberta enquanto importa. Pode usar o computador para outras coisas.</p>}

            <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--pill-bg)] text-left text-xs uppercase text-[var(--text-muted)]">
                  <tr>
                    <th className="p-2.5">Pasta</th>
                    <th className="p-2.5">Arquivos</th>
                    <th className="p-2.5">Condomínio</th>
                    <th className="p-2.5">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {pastas.map((p, i) => (
                    <tr key={p.pasta} className="border-t border-[var(--border)]">
                      <td className="p-2.5 font-semibold">{p.pasta}</td>
                      <td className="p-2.5 tabular-nums">{p.arquivos.length}</td>
                      <td className="p-2.5">
                        <select
                          value={p.destino}
                          disabled={rodando || p.estado === 'feita'}
                          onChange={(e) => setPastas((xs) => xs.map((x, k) => (k === i ? { ...x, destino: e.target.value } : x)))}
                          className={`max-w-[320px] rounded-lg border px-2 py-1 ${p.destino === 'pular' && p.opcoes.length ? 'border-amber-400 bg-[#FFF4D6]' : 'border-[var(--border)]'}`}
                        >
                          {p.opcoes.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.nome}
                              {o.bairro ? ` · ${o.bairro}` : ''}
                              {o.status === 'rascunho' ? ' (rascunho)' : ''} · {o.fotos} fotos
                            </option>
                          ))}
                          <option value="criar">+ Criar como rascunho</option>
                          <option value="pular">Pular esta pasta</option>
                        </select>
                      </td>
                      <td className="p-2.5 text-xs text-[var(--text-muted)]">
                        {p.estado === 'rodando' && <b className="text-accent">Importando… </b>}
                        {p.estado === 'pulada' && 'Pulada'}
                        {Object.entries(p.contagem)
                          .map(([k, n]) => `${n} ${ROTULO[k] ?? k}`)
                          .join(' · ')}
                        {p.estado === 'feita' && p.escolhido && (
                          <>
                            {' '}
                            <Link href={`/dashboard/condominios/${p.destino}/editar`} target="_blank" className="font-semibold text-accent">
                              ver ↗
                            </Link>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {pend && pend.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">Para conferir: plantas sem tipologia</h2>
            <p className="text-sm text-[var(--text-muted)]">A planta foi guardada, mas não achei tipologia com a mesma metragem. Cadastre a tipologia e envie a planta nela.</p>
            <ul className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] text-sm">
              {pend.map((x, k) => (
                <li key={k} className="flex flex-wrap items-center gap-3 p-2.5">
                  {x.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.url} alt="" className="h-12 w-16 rounded object-cover" />
                  )}
                  <span className="min-w-0 flex-1">
                    <b>{x.nome}</b> · {x.detalhe}
                    <span className="block truncate text-xs text-[var(--text-muted)]">{x.arquivo}</span>
                  </span>
                  <Link href={`/dashboard/condominios/${x.id}/editar`} target="_blank" className="text-xs font-semibold text-accent">
                    Abrir ↗
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

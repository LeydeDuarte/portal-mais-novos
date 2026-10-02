'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import PhotoUploadField from '@/components/PhotoUploadField';
import { TituloPainel, Vazio, campoPainel } from '@/components/painel/ui';
import { useStaffSession } from '@/lib/use-staff-session';
import {
  atualizarIndicadoresAgora,
  gerarCapasDiscover,
  excluirBanner,
  excluirNoticia,
  gerarChave,
  listarBanners,
  listarChaves,
  listarNoticiasAdmin,
  revogarChave,
  salvarBanner,
  type Banner
} from '@/lib/news/actions';
import { nomeTopico, urlNoticia, type Noticia } from '@/lib/news/base';
import PilulaStatus, { CORES_STATUS } from '@/components/news/PilulaStatus';

// Painel → News: notícias, banners, chaves para IA publicar e indicadores.
type Aba = 'noticias' | 'banners' | 'ia';
const POSICOES: { v: string; l: string }[] = [
  { v: 'perfil', l: 'Páginas de imóvel e condomínio (vertical 9:16)' },
  { v: 'lateral', l: 'News: lateral 300×250' },
  { v: 'lateral-grande', l: 'News: lateral grande 300×600' },
  { v: 'texto', l: 'News: dentro do texto 728×120' }
];

export default function AdminNews() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [aba, setAba] = useState<Aba>('noticias');
  const [lista, setLista] = useState<Noticia[] | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'rascunho' | 'agendada' | 'publicada'>('todas');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () => listarNoticiasAdmin().then(setLista).catch(() => setLista([]));
  useEffect(() => {
    if (staff) carregar();
  }, [staff]);

  if (!loaded || !staff) return <PainelNav />;
  if (staff.role !== 'admin' && staff.role !== 'analista')
    return (
      <div className="min-h-screen">
        <PainelNav />
        <p className="p-8 text-sm">O News é editado por administradores e analistas.</p>
      </div>
    );

  const itens = (lista ?? []).filter((n) => filtro === 'todas' || n.status === filtro);
  const cont = (s: string) => (lista ?? []).filter((n) => n.status === s).length;

  return (
    <div className="min-h-screen">
      <PainelNav />
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:px-6">
        <TituloPainel titulo="News" contagem={lista ? `${lista.length} publicação(ões)` : 'Carregando…'}>
          <Link href="/news" target="_blank" className="flex h-11 items-center rounded-full bg-[var(--pill-bg)] px-4 text-[13px] font-semibold">
            Ver o portal ↗
          </Link>
          <Link href="/dashboard/news/novo" className="flex h-11 items-center rounded-full bg-ink px-5 text-[14px] font-semibold text-white">
            + Nova notícia
          </Link>
        </TituloPainel>

        <div className="mt-6 flex gap-2 border-b border-[var(--border)]">
          {(
            [
              ['noticias', 'Notícias'],
              ['banners', 'Banners'],
              ['ia', 'Publicar por IA e indicadores']
            ] as [Aba, string][]
          ).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setAba(v)} className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold ${aba === v ? 'border-accent' : 'border-transparent text-[var(--text-muted)]'}`}>
              {l}
            </button>
          ))}
        </div>
        {msg && (
          <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" onClick={() => setMsg(null)}>
            {msg}
          </p>
        )}

        {aba === 'noticias' && (
          <div className="mt-5">
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              {(
                [
                  ['todas', `Todas (${lista?.length ?? 0})`],
                  ['rascunho', `Rascunhos (${cont('rascunho')})`],
                  ['agendada', `Agendadas (${cont('agendada')})`],
                  ['publicada', `Publicadas (${cont('publicada')})`]
                ] as [typeof filtro, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFiltro(v)}
                  className={`rounded-full px-3.5 py-2 ${
                    filtro === v ? 'bg-ink font-semibold text-white' : v === 'todas' ? 'bg-[var(--pill-bg)]' : `font-medium ring-1 ${CORES_STATUS[v]}`
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            {lista && itens.length === 0 ? (
              <Vazio titulo="Nenhuma notícia aqui" texto="Crie a primeira em + Nova notícia, ou deixe uma IA publicar pela chave de acesso." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                {itens.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 border-b border-[var(--border)] p-4 last:border-b-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {n.capa ? <img src={n.capa} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" /> : <span className="h-14 w-20 shrink-0 rounded-lg bg-[var(--pill-bg)]" />}
                    <Link href={`/dashboard/news/${n.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{n.titulo}</span>
                        {n.principal && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">PRINCIPAL</span>}
                        {n.origem === 'ia' && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">IA</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-muted)]">
                        <PilulaStatus status={n.status} agendadoPara={n.agendadoPara} />
                        <span>
                          {nomeTopico(n.topico)}
                          {n.cidade ? ` · ${n.cidade}` : ''} · {n.leituras} leitura(s)
                        </span>
                      </div>
                    </Link>
                    <a href={n.status === 'publicada' ? urlNoticia(n) : `/news/previa/${n.id}`} target="_blank" rel="noopener" className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-[var(--pill-bg)]">
                      {n.status === 'publicada' ? 'Ver ↗' : 'Prévia ↗'}
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Excluir "${n.titulo}"? Não dá para desfazer.`)) return;
                        await excluirNoticia(n.id);
                        carregar();
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {aba === 'banners' && <AbaBanners onMsg={setMsg} />}
        {aba === 'ia' && <AbaIA onMsg={setMsg} />}
      </div>
    </div>
  );
}

function AbaBanners({ onMsg }: { onMsg: (m: string) => void }) {
  const [lista, setLista] = useState<Banner[]>([]);
  const [novo, setNovo] = useState<{ posicao: string; imagem: string[]; video: string; link: string; titulo: string; inicio: string; fim: string }>({ posicao: 'perfil', imagem: [], video: '', link: '', titulo: '', inicio: '', fim: '' });
  const [erro, setErro] = useState<string | null>(null);
  const carregar = () => listarBanners().then(setLista).catch(() => setLista([]));
  useEffect(() => {
    carregar();
  }, []);
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-3">
        {lista.length === 0 && <Vazio titulo="Nenhum banner" texto="Sem banner, o espaço mostra &quot;Anuncie aqui&quot; com o seu WhatsApp." />}
        {lista.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {b.imagem ? <img src={b.imagem} alt="" className="h-16 w-24 rounded-lg object-cover" /> : <span className="flex h-16 w-24 items-center justify-center rounded-lg bg-ink text-xs font-bold text-white">▶ vídeo</span>}
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">{b.titulo || 'Banner'}</div>
              <div className="text-[var(--text-muted)]">
                {POSICOES.find((p) => p.v === b.posicao)?.l} · {b.ativo ? 'ativo' : 'pausado'}
                {b.fim ? ` · até ${b.fim.split('-').reverse().join('/')}` : ''}
              </div>
            </div>
            <button type="button" onClick={async () => { await salvarBanner({ ...b, ativo: !b.ativo }); carregar(); }} className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-[var(--pill-bg)]">
              {b.ativo ? 'Pausar' : 'Ativar'}
            </button>
            <button type="button" onClick={async () => { if (window.confirm('Excluir este banner?')) { await excluirBanner(b.id); carregar(); } }} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
              Excluir
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-4">
        <h2 className="font-bold">Novo banner</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Posição</span>
          <select className={campoPainel} value={novo.posicao} onChange={(e) => setNovo({ ...novo, posicao: e.target.value })}>
            {POSICOES.map((p) => (
              <option key={p.v} value={p.v}>
                {p.l}
              </option>
            ))}
          </select>
        </label>
        <PhotoUploadField photos={novo.imagem} onChange={(f) => setNovo({ ...novo, imagem: f.slice(-1) })} folder="site" label="Imagem do banner" compacto />
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
          Ou vídeo vertical (YouTube ou Vimeo)
          <input className={campoPainel} placeholder="https://youtube.com/shorts/..." value={novo.video} onChange={(e) => setNovo({ ...novo, video: e.target.value })} />
          <span className="font-normal">Grave em pé (9:16). Toca sozinho, sem som e em repetição, preenchendo o quadro. Com vídeo, a imagem é ignorada.</span>
        </label>
        <input className={campoPainel} placeholder="Link ao clicar (https://...)" value={novo.link} onChange={(e) => setNovo({ ...novo, link: e.target.value })} />
        <input className={campoPainel} placeholder="Nome do anunciante" value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
            Início
            <input type="date" className={campoPainel} value={novo.inicio} onChange={(e) => setNovo({ ...novo, inicio: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
            Fim
            <input type="date" className={campoPainel} value={novo.fim} onChange={(e) => setNovo({ ...novo, fim: e.target.value })} />
          </label>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button
          type="button"
          onClick={async () => {
            const r = await salvarBanner({ posicao: novo.posicao, imagem: novo.imagem[0] ?? null, videoUrl: novo.video || null, link: novo.link, titulo: novo.titulo, inicio: novo.inicio || null, fim: novo.fim || null });
            if (!r.ok) return setErro(r.erro ?? 'Erro');
            setErro(null);
            setNovo({ posicao: 'perfil', imagem: [], video: '', link: '', titulo: '', inicio: '', fim: '' });
            onMsg('Banner salvo.');
            carregar();
          }}
          className="h-11 rounded-full bg-ink text-sm font-bold text-white"
        >
          Salvar banner
        </button>
      </div>
    </div>
  );
}

function AbaIA({ onMsg }: { onMsg: (m: string) => void }) {
  const [chaves, setChaves] = useState<Awaited<ReturnType<typeof listarChaves>>>([]);
  const [nova, setNova] = useState<string | null>(null);
  const [nome, setNome] = useState('Claude');
  const [ind, setInd] = useState<string | null>(null);
  const carregar = () => listarChaves().then(setChaves).catch(() => setChaves([]));
  useEffect(() => {
    carregar();
  }, []);
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-5">
        <h2 className="font-bold">Chaves para IA publicar</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Com a chave, o Claude (ou outra IA) envia notícias com texto e capa para <code>/api/news</code>. Sem pedir o contrário, elas entram como rascunho para você aprovar aqui.
        </p>
        <div className="flex gap-2">
          <input className={`${campoPainel} flex-1`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (ex.: Claude)" />
          <button
            type="button"
            onClick={async () => {
              setNova(await gerarChave(nome));
              carregar();
            }}
            className="rounded-full bg-ink px-4 text-sm font-bold text-white"
          >
            Gerar chave
          </button>
        </div>
        {nova && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm">
            <strong>Copie agora, ela não aparece de novo:</strong>
            <code className="mt-1 block break-all rounded bg-white p-2 text-xs">{nova}</code>
          </div>
        )}
        {chaves.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 text-sm">
            <span>
              <strong>{c.nome}</strong> · criada em {new Date(c.criadoEm).toLocaleDateString('pt-BR')}
              {c.ultimoUso ? ` · usada em ${new Date(c.ultimoUso).toLocaleDateString('pt-BR')}` : ' · nunca usada'}
              {!c.ativa && ' · revogada'}
            </span>
            {c.ativa && (
              <button type="button" onClick={async () => { await revogarChave(c.id); carregar(); }} className="text-xs font-semibold text-red-600">
                Revogar
              </button>
            )}
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-5">
        <h2 className="font-bold">Indicadores (Banco Central)</h2>
        <p className="text-sm text-[var(--text-muted)]">Selic, IPCA, INCC-DI, INCC-M e IGP-M são atualizados sozinhos todo dia às 9h. Use o botão se quiser forçar agora.</p>
        <button
          type="button"
          onClick={async () => {
            setInd('Buscando no Banco Central…');
            const r = await atualizarIndicadoresAgora().catch((e) => ({ erro: String(e) }));
            setInd(Object.entries(r).map(([k, v]) => `${k}: ${typeof v === 'number' ? `${v} ponto(s)` : v}`).join(' · '));
            onMsg('Indicadores atualizados.');
          }}
          className="h-11 rounded-full border border-[var(--border)] text-sm font-bold"
        >
          Atualizar indicadores agora
        </button>
        {ind && <p className="text-sm">{ind}</p>}
        <div className="mt-2 border-t border-[var(--border)] pt-3">
          <h3 className="text-sm font-bold">Capas para o Google Discover</h3>
          <p className="text-sm text-[var(--text-muted)]">Gera a versão 1200×675 em WebP das capas que ainda não têm. As notícias novas já ganham ao salvar.</p>
          <button
            type="button"
            onClick={async () => {
              setInd('Gerando capas…');
              const n = await gerarCapasDiscover().catch(() => 0);
              setInd(`${n} capa(s) gerada(s).`);
            }}
            className="mt-2 h-11 w-full rounded-full border border-[var(--border)] text-sm font-bold"
          >
            Gerar capas que faltam
          </button>
        </div>
      </section>
    </div>
  );
}


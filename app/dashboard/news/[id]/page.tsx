'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import PhotoUploadField from '@/components/PhotoUploadField';
import { campoPainel } from '@/components/painel/ui';
import { useStaffSession } from '@/lib/use-staff-session';
import { lerNoticiaAdmin, salvarNoticia } from '@/lib/news/actions';
import { FOCOS, TOPICOS, UFS, blocosDoTexto, clichesNoTexto, focoDaNoticia, minutosLeitura, slugNews, textoPuro, urlNoticia } from '@/lib/news/base';

// Editor de notícia. O texto usa marcações simples (## subtítulo, > citação, - lista,
// **negrito**) e blocos especiais inseridos pelos botões.
type Form = {
  titulo: string;
  linhaFina: string;
  corpo: string;
  resumo: string;
  faq: { p: string; r: string }[];
  capa: string[];
  capaAlt: string;
  videoUrl: string;
  topico: string;
  tags: string;
  uf: string;
  cidade: string;
  bairro: string;
  autor: string;
  principal: boolean;
  seoTitulo: string;
  seoDescricao: string;
  fontes: string;
  agendadoPara: string;
  status: 'rascunho' | 'agendada' | 'publicada';
  slug: string;
  focoImoveis: string;
};
const VAZIO: Form = {
  titulo: '', linhaFina: '', corpo: '', resumo: '', faq: [], capa: [], capaAlt: '', videoUrl: '', topico: 'mercado', tags: '', uf: 'GO', cidade: 'Goiânia',
  bairro: '', autor: 'Leyde Duarte', principal: false, seoTitulo: '', seoDescricao: '', fontes: '', agendadoPara: '', status: 'rascunho', slug: '', focoImoveis: 'auto'
};

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--text-muted)]">
        {rotulo}
        {dica && <span className="font-normal"> · {dica}</span>}
      </span>
      {children}
    </label>
  );
}

export default function EditorNoticia() {
  const { id } = useParams<{ id: string }>();
  const novo = id === 'novo';
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [f, setF] = useState<Form>(VAZIO);
  const [carregado, setCarregado] = useState(novo);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const corpoRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (!staff || novo) return;
    lerNoticiaAdmin(id).then((n) => {
      if (!n) return setMsg({ ok: false, t: 'Notícia não encontrada.' });
      setF({
        titulo: n.titulo, linhaFina: n.linhaFina ?? '', corpo: n.corpo, resumo: n.resumo.join('\n'), faq: n.faq, capa: n.capa ? [n.capa] : [], capaAlt: n.capaAlt ?? '',
        videoUrl: n.videoUrl ?? '', topico: n.topico, tags: n.tags.join(', '), uf: n.uf ?? '', cidade: n.cidade ?? '', bairro: n.bairro ?? '', autor: n.autor,
        principal: n.principal, seoTitulo: n.seoTitulo ?? '', seoDescricao: n.seoDescricao ?? '',
        fontes: n.fontes.map((x) => (x.url ? `${x.nome} | ${x.url}` : x.nome)).join('\n'),
        agendadoPara: n.agendadoPara ? new Date(new Date(n.agendadoPara).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
        status: n.status, slug: n.slug, focoImoveis: n.focoImoveis
      });
      setUrl(n.status === 'publicada' ? urlNoticia(n) : `/news/previa/${n.id}`);
      setCarregado(true);
    });
  }, [staff, id, novo]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const texto = useMemo(() => textoPuro(f.corpo), [f.corpo]);
  const tituloSeo = f.seoTitulo || f.titulo;
  const descSeo = f.seoDescricao || f.linhaFina || texto.slice(0, 155);
  const cliches = useMemo(() => clichesNoTexto(`${f.titulo} ${f.linhaFina} ${f.corpo} ${f.resumo}`), [f.titulo, f.linhaFina, f.corpo, f.resumo]);
  const checks = [
    { ok: tituloSeo.length >= 40 && tituloSeo.length <= 65, t: `Título para o Google com ${tituloSeo.length} caracteres (ideal 50 a 60)` },
    { ok: descSeo.length >= 110 && descSeo.length <= 160, t: `Descrição com ${descSeo.length} caracteres (ideal 120 a 155)` },
    { ok: f.resumo.trim().split('\n').filter(Boolean).length >= 2, t: 'Resumo "Em 30 segundos" com pelo menos 2 linhas' },
    { ok: f.capa.length > 0 || !!f.videoUrl, t: 'Capa (foto ou vídeo)' },
    { ok: !f.capa.length || f.capaAlt.length > 10, t: 'Descrição da foto de capa (acessibilidade e Google Imagens)' },
    { ok: /\]\(\/|maisnovosimoveis\.com|\[\[imoveis/.test(f.corpo), t: 'Pelo menos 1 link ou bloco de imóveis do site' },
    { ok: blocosDoTexto(f.corpo).some((b) => b.t === 'h2'), t: 'Subtítulos (## ) organizando o texto' },
    { ok: f.faq.length > 0, t: 'Perguntas frequentes (viram resposta no Google e nas IAs)' },
    { ok: !!f.cidade, t: 'Cidade preenchida (liga a notícia à página da região)' },
    { ok: cliches.length === 0, t: cliches.length ? `Frases que soam robóticas: "${cliches.slice(0, 3).join('", "')}"` : 'Sem frases que soam robóticas' }
  ];

  const inserir = (trecho: string) => {
    const el = corpoRef.current;
    const pos = el ? el.selectionStart : f.corpo.length;
    const antes = f.corpo.slice(0, pos);
    const depois = f.corpo.slice(pos);
    const bloco = `${antes && !antes.endsWith('\n\n') ? (antes.endsWith('\n') ? '\n' : '\n\n') : ''}${trecho}\n\n`;
    set('corpo', antes + bloco + depois);
    setTimeout(() => el?.focus(), 0);
  };
  const bairroAttr = `${f.bairro ? ` bairro="${f.bairro}"` : ''}${f.cidade ? ` cidade="${f.cidade}"` : ''}`;
  const BOTOES: [string, string][] = [
    ['Subtítulo', '## Subtítulo'],
    ['Citação', '> "Frase de impacto aqui."'],
    ['Lista', '- Primeiro ponto\n- Segundo ponto'],
    ['Imóveis do bairro', `[[imoveis${bairroAttr} qtd="3"]]`],
    ['Números do banco', `[[dados${bairroAttr}]]`],
    ['Vídeo', '[[video url="https://youtu.be/"]]'],
    ['Imagem', '![Legenda da imagem](https://)'],
    ['Banner', '[[banner]]'],
    ['Leia também', '[[leia slug="endereco-da-noticia"]]']
  ];

  const salvar = async (status: Form['status']) => {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await salvarNoticia({
        id: novo ? undefined : id,
        titulo: f.titulo,
        linhaFina: f.linhaFina,
        corpo: f.corpo,
        resumo: f.resumo.split('\n').map((x) => x.replace(/^[-›•]\s*/, '').trim()).filter(Boolean),
        faq: f.faq.filter((x) => x.p.trim() && x.r.trim()),
        capa: f.capa[0] ?? null,
        capaAlt: f.capaAlt,
        videoUrl: f.videoUrl,
        topico: f.topico,
        tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean),
        uf: f.uf || null,
        cidade: f.cidade,
        bairro: f.bairro,
        autor: f.autor,
        principal: f.principal,
        seoTitulo: f.seoTitulo,
        seoDescricao: f.seoDescricao,
        fontes: f.fontes.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]).map(([nome, u]) => ({ nome, url: u })),
        agendadoPara: status === 'agendada' && f.agendadoPara ? new Date(f.agendadoPara).toISOString() : null,
        status,
        slug: f.slug && !novo ? f.slug : undefined,
        focoImoveis: f.focoImoveis
      });
      if (!r.ok) return setMsg({ ok: false, t: r.erro });
      set('status', r.noticia.status);
      set('slug', r.noticia.slug);
      setUrl(r.noticia.status === 'publicada' ? urlNoticia(r.noticia) : `/news/previa/${r.noticia.id}`);
      setMsg({ ok: true, t: status === 'publicada' ? 'Publicada. Pode levar até 5 minutos para aparecer na capa.' : status === 'agendada' ? 'Agendada.' : 'Rascunho salvo.' });
      if (novo) router.replace(`/dashboard/news/${r.noticia.id}`);
    } catch (e) {
      setMsg({ ok: false, t: e instanceof Error ? e.message : 'Não foi possível salvar.' });
    } finally {
      setSalvando(false);
    }
  };

  if (!loaded || !staff) return <PainelNav />;
  if (!carregado)
    return (
      <div className="min-h-screen">
        <PainelNav />
        <p className="p-8 text-sm text-[var(--text-muted)]">{msg?.t ?? 'Carregando…'}</p>
      </div>
    );

  return (
    <div className="min-h-screen">
      <PainelNav />
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 pb-24 pt-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <main className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard/news" className="font-semibold text-[var(--text-muted)]">
              ← News
            </Link>
            {url && (
              <a href={url} target="_blank" rel="noopener" className="font-semibold text-accent">
                {f.status === 'publicada' ? 'Ver no site ↗' : 'Prévia ↗'}
              </a>
            )}
          </div>
          <textarea
            value={f.titulo}
            onChange={(e) => set('titulo', e.target.value)}
            placeholder="Título da notícia"
            rows={2}
            className="resize-none bg-transparent font-serif text-[30px] font-semibold leading-tight outline-none"
          />
          <Campo rotulo="Linha fina" dica="aparece abaixo do título">
            <textarea rows={2} className={campoPainel} value={f.linhaFina} onChange={(e) => set('linhaFina', e.target.value)} />
          </Campo>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <PhotoUploadField photos={f.capa} onChange={(x) => set('capa', x.slice(-1))} folder="noticias" label="Imagem de capa" compacto nomeArquivo={f.titulo || 'noticia'} />
              <input className={campoPainel} placeholder="Descrição da foto (o que aparece nela)" value={f.capaAlt} onChange={(e) => set('capaAlt', e.target.value)} />
            </div>
            <Campo rotulo="Vídeo de capa" dica="YouTube ou Vimeo; toca sozinho e sem som">
              <input className={campoPainel} placeholder="https://youtu.be/..." value={f.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} />
            </Campo>
          </div>
          <Campo rotulo="Em 30 segundos" dica="uma linha por item, 2 ou 3 itens">
            <textarea rows={3} className={campoPainel} value={f.resumo} onChange={(e) => set('resumo', e.target.value)} />
          </Campo>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {BOTOES.map(([l, t]) => (
                <button key={l} type="button" onClick={() => inserir(t)} className="h-8 rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold hover:bg-[var(--pill-bg)]">
                  {l}
                </button>
              ))}
            </div>
            <textarea
              ref={corpoRef}
              value={f.corpo}
              onChange={(e) => set('corpo', e.target.value)}
              rows={24}
              placeholder="Escreva o texto aqui. Parágrafos separados por uma linha em branco."
              className="w-full resize-y rounded-xl border border-[var(--border)] p-3 font-mono text-[14px] leading-relaxed outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {texto.split(/\s+/).filter(Boolean).length} palavras · {minutosLeitura(texto)} min de leitura · **negrito**, *itálico*, [texto](/endereco) para link
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold">Perguntas frequentes</span>
              <button type="button" onClick={() => set('faq', [...f.faq, { p: '', r: '' }])} className="text-sm font-semibold text-accent">
                + Adicionar
              </button>
            </div>
            {f.faq.map((q, i) => (
              <div key={i} className="mb-2 flex flex-col gap-1.5 border-b border-[var(--border)] pb-2">
                <input className={campoPainel} placeholder="Pergunta" value={q.p} onChange={(e) => set('faq', f.faq.map((x, j) => (j === i ? { ...x, p: e.target.value } : x)))} />
                <textarea rows={2} className={campoPainel} placeholder="Resposta direta, em 1 ou 2 frases" value={q.r} onChange={(e) => set('faq', f.faq.map((x, j) => (j === i ? { ...x, r: e.target.value } : x)))} />
                <button type="button" onClick={() => set('faq', f.faq.filter((_, j) => j !== i))} className="self-end text-xs font-semibold text-red-600">
                  Tirar
                </button>
              </div>
            ))}
          </div>
          <Campo rotulo="Fontes" dica="uma por linha: Nome | https://link">
            <textarea rows={3} className={campoPainel} value={f.fontes} onChange={(e) => set('fontes', e.target.value)} />
          </Campo>
        </main>

        <aside className="flex flex-col gap-4">
          <div className="sticky top-24 flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] p-4">
              <div className="flex gap-2">
                <button type="button" disabled={salvando || !f.titulo.trim()} onClick={() => salvar('rascunho')} className="h-11 flex-1 rounded-full border border-[var(--border)] text-sm font-bold disabled:opacity-50">
                  Salvar rascunho
                </button>
                <button type="button" disabled={salvando || !f.titulo.trim()} onClick={() => salvar('publicada')} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold text-white disabled:opacity-50">
                  {f.status === 'publicada' ? 'Atualizar' : 'Publicar'}
                </button>
              </div>
              <div className="flex gap-2">
                <input type="datetime-local" className={`${campoPainel} flex-1`} value={f.agendadoPara} onChange={(e) => set('agendadoPara', e.target.value)} />
                <button type="button" disabled={salvando || !f.agendadoPara} onClick={() => salvar('agendada')} className="rounded-full border border-[var(--border)] px-3 text-sm font-semibold disabled:opacity-40">
                  Agendar
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Situação: <strong>{f.status === 'publicada' ? 'publicada' : f.status === 'agendada' ? 'agendada' : 'rascunho'}</strong>
              </p>
              {msg && <p className={`rounded-lg p-2 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.t}</p>}
            </div>

            <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--border)] p-4">
              <Campo rotulo="Tópico">
                <select className={campoPainel} value={f.topico} onChange={(e) => set('topico', e.target.value)}>
                  {TOPICOS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="grid grid-cols-[90px_1fr] gap-2">
                <Campo rotulo="Estado">
                  <select className={campoPainel} value={f.uf} onChange={(e) => set('uf', e.target.value)}>
                    <option value="">-</option>
                    {Object.keys(UFS).map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Cidade">
                  <input className={campoPainel} value={f.cidade} onChange={(e) => set('cidade', e.target.value)} />
                </Campo>
              </div>
              <Campo rotulo="Bairro" dica="liga os imóveis do bairro à notícia">
                <input className={campoPainel} value={f.bairro} onChange={(e) => set('bairro', e.target.value)} />
              </Campo>
              <Campo rotulo="Imóveis mostrados na notícia" dica={f.focoImoveis === 'auto' ? `detectado: ${FOCOS.find((x) => x.v === focoDaNoticia({ focoImoveis: 'auto', titulo: f.titulo, linhaFina: f.linhaFina, tags: f.tags.split(','), corpo: f.corpo }))?.l.toLowerCase() ?? 'assunto geral (vários tipos)'}` : undefined}>
                <select className={campoPainel} value={f.focoImoveis} onChange={(e) => set('focoImoveis', e.target.value)}>
                  {FOCOS.map((x) => (
                    <option key={x.v} value={x.v}>
                      {x.l}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Palavras-chave" dica="separadas por vírgula">
                <input className={campoPainel} value={f.tags} onChange={(e) => set('tags', e.target.value)} />
              </Campo>
              <Campo rotulo="Autor">
                <input className={campoPainel} value={f.autor} onChange={(e) => set('autor', e.target.value)} />
              </Campo>
              <label className="flex items-center justify-between text-sm">
                <span>Principal da capa</span>
                <input type="checkbox" checked={f.principal} onChange={(e) => set('principal', e.target.checked)} />
              </label>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] p-4">
              <span className="text-sm font-bold">Como aparece no Google</span>
              <div className="rounded-xl border border-[var(--border)] p-3">
                <div className="truncate text-xs text-[#1A7F37]">maisnovosimoveis.com › news › {f.topico} › {f.slug || slugNews(f.titulo)}</div>
                <div className="text-[17px] leading-snug text-[#1A0DAB]">{tituloSeo || 'Título da notícia'}</div>
                <div className="text-[13px] leading-snug text-[#4D5156]">{descSeo.slice(0, 160)}</div>
              </div>
              <input className={campoPainel} placeholder="Título para o Google (opcional, 50 a 60 caracteres)" value={f.seoTitulo} onChange={(e) => set('seoTitulo', e.target.value)} />
              <textarea rows={2} className={campoPainel} placeholder="Descrição para o Google (opcional)" value={f.seoDescricao} onChange={(e) => set('seoDescricao', e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--border)] p-4 text-[13px]">
              <span className="text-sm font-bold">Checagem antes de publicar</span>
              {checks.map((c) => (
                <span key={c.t} className={c.ok ? 'text-[#1A7F37]' : 'text-[#B45309]'}>
                  {c.ok ? '✓' : '!'} {c.t}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

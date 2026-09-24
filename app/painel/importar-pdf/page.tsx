'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import AmenitiesCheckboxes from '@/components/AmenitiesCheckboxes';
import DescriptionEditor from '@/components/forms/DescriptionEditor';
import { useStaffSession } from '@/lib/use-staff-session';
import { createDevelopment, saveTipologias, listCondominios, getDevelopmentForEdit, type CondominioResumo } from '@/lib/actions';
import { lerPdf, type PdfDoc } from '@/lib/pdf-import/extract';
import { analisarDocs, classificarDoc, gerarDescricao, semAcento, type ImportResult, type TipoDoc } from '@/lib/pdf-import/parse';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { maskCurrencyInput } from '@/lib/currency';
import { formatLocation } from '@/components/CepField';

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none';
const TIPO_DOC_LABEL: Record<TipoDoc, string> = { tabela: 'Tabela de vendas', ficha: 'Ficha técnica', plantas: 'Caderno de plantas', book: 'Book', outro: 'Outro' };

type Arquivo = { file: File; doc?: PdfDoc; tipo?: TipoDoc; erro?: string };
type LinhaTip = { incluir: boolean; tipoUnidade: TipoUnidade; area: string; quartos: string; vagas: string; precoDigits: string; info: string };

const norm = (s: string) => semAcento(s.toLowerCase()).replace(/[^a-z0-9]/g, '');

export default function ImportarPdfPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [lendo, setLendo] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<string>('');
  const [res, setRes] = useState<ImportResult | null>(null);
  const [f, setF] = useState({ nome: '', cep: '', logradouro: '', bairro: '', cidade: '', uf: '', entrega: '', pavimentos: '', tipo: 'vertical' as 'vertical' | 'horizontal' });
  const [amenities, setAmenities] = useState<string[]>([]);
  const [tips, setTips] = useState<LinhaTip[]>([]);
  const [descricao, setDescricao] = useState('');
  const [condos, setCondos] = useState<CondominioResumo[]>([]);
  const [destino, setDestino] = useState<'novo' | string>('novo');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => {
    if (staff) listCondominios().then(setCondos).catch(() => {});
  }, [staff]);

  const adicionar = (lista: FileList | null) => {
    if (!lista) return;
    const novos = Array.from(lista).filter((x) => x.type === 'application/pdf' || /\.pdf$/i.test(x.name));
    setArquivos((a) => [...a, ...novos.filter((n) => !a.some((x) => x.file.name === n.name && x.file.size === n.size)).map((file) => ({ file }))]);
    setRes(null);
  };

  const ler = async () => {
    setErro(null);
    const lidos: Arquivo[] = [];
    for (const a of arquivos) {
      if (a.doc) {
        lidos.push(a);
        continue;
      }
      setLendo(a.file.name);
      setProgresso('');
      try {
        const doc = await lerPdf(a.file, a.file.name, (pg, tot) => setProgresso(`página ${pg} de ${tot}`));
        lidos.push({ ...a, doc, tipo: classificarDoc(doc) });
      } catch {
        lidos.push({ ...a, erro: 'Não foi possível abrir este PDF (protegido por senha ou corrompido).' });
      }
    }
    setArquivos(lidos);
    setLendo(null);
    const docs = lidos.map((a) => a.doc).filter(Boolean) as PdfDoc[];
    if (!docs.length) return;
    const r = analisarDocs(docs);
    setRes(r);
    setF({
      nome: r.nome,
      cep: r.endereco.cep,
      logradouro: r.endereco.logradouro,
      bairro: r.endereco.bairro,
      cidade: r.endereco.cidade,
      uf: r.endereco.uf,
      entrega: r.entrega ?? '',
      pavimentos: r.pavimentos ? String(r.pavimentos) : '',
      tipo: r.tipo
    });
    setAmenities(r.amenities);
    setDescricao(r.descricao);
    setTips(
      r.tipologias.map((t) => ({
        incluir: t.total === 0 || t.disponiveis > 0,
        tipoUnidade: t.tipoUnidade,
        area: String(t.area).replace('.', ','),
        quartos: t.quartos ? String(t.quartos) : '',
        vagas: t.vagas ? String(t.vagas) : '',
        precoDigits: t.precoMin ? String(Math.round(t.precoMin)) : '',
        info: t.total
          ? `${t.disponiveis} de ${t.total} unidade(s) disponível(is) na tabela${t.unidades.length ? ` · ${t.unidades.slice(0, 6).join(', ')}${t.unidades.length > 6 ? '…' : ''}` : ''}${t.rotulo ? ` · ${t.rotulo}` : ''}`
          : t.rotulo ?? 'da ficha/plantas (sem preço)'
      }))
    );
    const igual = condos.find((c) => norm(c.name) === norm(r.nome));
    setDestino(igual ? igual.id : 'novo');
    // CEP pelo endereço (ViaCEP), se o material não trouxe
    if (!r.endereco.cep && r.endereco.uf && r.endereco.cidade && r.endereco.logradouro) {
      const rua = r.endereco.logradouro.split(',')[0].replace(/(\d)\.(\d)/g, '$1$2');
      fetch(`https://viacep.com.br/ws/${r.endereco.uf}/${encodeURIComponent(r.endereco.cidade)}/${encodeURIComponent(rua)}/json/`)
        .then((x) => x.json())
        .then((lista: { cep: string; bairro: string }[]) => {
          if (!Array.isArray(lista) || !lista.length) return;
          const doBairro = lista.filter((l) => norm(l.bairro) === norm(r.endereco.bairro));
          const unico = doBairro.length ? doBairro : lista.length === 1 ? lista : [];
          if (unico[0]) setF((p) => (p.cep ? p : { ...p, cep: unico[0].cep }));
        })
        .catch(() => {});
    }
  };

  const setTip = (i: number, patch: Partial<LinhaTip>) => setTips((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const tipsFinais = () =>
    tips
      .filter((t) => t.incluir)
      .map((t) => ({
        tipoUnidade: t.tipoUnidade,
        area: t.area ? Number(t.area.replace(/\./g, '').replace(',', '.')) : undefined,
        quartos: t.quartos ? Number(t.quartos) : undefined,
        vagas: t.vagas ? Number(t.vagas) : undefined,
        priceValue: t.precoDigits ? Number(t.precoDigits) : 0
      }));

  const regerarDescricao = () => {
    if (!res) return;
    const t = tips
      .map((x, i) => ({ x, i }))
      .filter(({ x }) => x.incluir)
      .map(({ x, i }) => ({
        ...res.tipologias[i],
        tipoUnidade: x.tipoUnidade,
        area: Number(x.area.replace(/\./g, '').replace(',', '.')) || 0,
        quartos: x.quartos ? Number(x.quartos) : undefined,
        vagas: x.vagas ? Number(x.vagas) : undefined,
        precoMin: x.precoDigits ? Number(x.precoDigits) : undefined
      }));
    setDescricao(
      gerarDescricao({
        ...res,
        nome: f.nome,
        endereco: { ...res.endereco, bairro: f.bairro, cidade: f.cidade, uf: f.uf, logradouro: f.logradouro },
        entrega: f.entrega || undefined,
        pavimentos: f.pavimentos ? Number(f.pavimentos) : undefined,
        amenities,
        tipologias: t
      })
    );
  };

  const salvar = async () => {
    setErro(null);
    if (!f.nome.trim()) return setErro('Informe o nome do empreendimento.');
    setSalvando(true);
    try {
      if (destino !== 'novo') {
        // Atualiza só a tabela (tipologias e preços) do condomínio que já existe,
        // mantendo os ids das tipologias de mesma metragem.
        const atual = await getDevelopmentForEdit(destino);
        const novas = tipsFinais().map((t) => {
          const mesma = atual?.tipologias.find((x) => x.area && t.area && Math.abs(x.area - t.area) / t.area < 0.01 && x.tipoUnidade === t.tipoUnidade);
          return mesma ? { ...t, id: mesma.id } : t;
        });
        await saveTipologias(destino, novas);
        router.push(`/painel/condominios/${destino}/editar`);
        return;
      }
      const id = `condo-${Date.now()}`;
      const tiposUnidade = Array.from(new Set(tipsFinais().map((t) => t.tipoUnidade)));
      const quartosOpcoes = Array.from(new Set(tipsFinais().map((t) => t.quartos).filter(Boolean) as number[])).sort((a, b) => a - b);
      const r = await createDevelopment({
        id,
        name: f.nome.trim(),
        location: formatLocation({ cep: f.cep, logradouro: f.logradouro, bairro: f.bairro, cidade: f.cidade, uf: f.uf }),
        deliveryDate: f.entrega || undefined,
        description: descricao,
        tipo: f.tipo,
        pavimentos: f.tipo === 'vertical' && f.pavimentos ? Number(f.pavimentos) : undefined,
        areaTerreno: f.tipo === 'horizontal' ? res?.areaTerreno : undefined,
        amenities,
        aceitaTemporada: false,
        photos: [],
        tiposUnidade,
        quartosOpcoes,
        cep: f.cep || undefined,
        logradouro: f.logradouro || undefined,
        bairro: f.bairro || undefined,
        cidade: f.cidade || undefined,
        uf: f.uf || undefined,
        status: 'rascunho'
      });
      if (!r.ok) throw new Error('Faltando: ' + r.faltando.join(', '));
      if (f.entrega) await saveTipologias(id, tipsFinais());
      router.push(`/painel/condominios/${id}/editar`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
      setSalvando(false);
    }
  };

  if (!loaded || !staff) return null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const existente = destino !== 'novo' ? condos.find((c) => c.id === destino) : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Importar lançamento por PDF</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Envie a ficha técnica, a tabela de vendas, o caderno de plantas e/ou o book. O sistema lê o texto dos arquivos (sem IA), monta o condomínio e as tipologias, e você confere antes de salvar. Os PDFs são lidos aqui no navegador — não sobem para o servidor.
        </p>

        {/* 1. Arquivos */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            adicionar(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-5 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center text-sm transition-colors ${arrastando ? 'border-accent bg-[#fbf8ee]' : 'border-[var(--border)] hover:bg-[var(--pill-bg)]'}`}
        >
          <strong>Clique ou arraste os PDFs aqui</strong>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Pode mandar vários de uma vez, inclusive books de 100 MB ou mais — a leitura é feita aqui no seu computador, nada sobe para o servidor.</div>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => adicionar(e.target.files)} />
        </div>

        {arquivos.length > 0 && (
          <ul className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {arquivos.map((a, i) => (
              <li key={a.file.name + i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{a.file.name}</span>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">{a.file.size < 1024 * 1024 ? `${Math.max(1, Math.round(a.file.size / 1024))} KB` : `${(a.file.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`}</span>
                {a.tipo && <span className="shrink-0 rounded bg-[var(--pill-bg)] px-2 py-0.5 text-[11px] font-bold">{TIPO_DOC_LABEL[a.tipo]} · {a.doc?.paginas.length} pág.</span>}
                {a.erro && <span className="shrink-0 text-xs font-semibold text-red-600">{a.erro}</span>}
                {lendo === a.file.name && <span className="shrink-0 text-xs text-accent">lendo… {progresso}</span>}
                <button type="button" className="shrink-0 text-xs text-[var(--text-muted)] hover:text-red-600" onClick={() => { setArquivos((x) => x.filter((_, j) => j !== i)); setRes(null); }}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {arquivos.length > 0 && (
          <button type="button" disabled={!!lendo} onClick={ler} className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
            {lendo ? 'Lendo os arquivos…' : res ? 'Ler de novo' : 'Ler arquivos'}
          </button>
        )}

        {/* 2. Conferência */}
        {res && (
          <div className="mt-8 space-y-6">
            <section className="rounded-2xl border border-[var(--border)] p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">O que foi encontrado</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {res.encontrados.map((e, i) => (
                  <li key={i}>
                    <strong>{e.campo}:</strong> {e.valor} <span className="text-xs text-[var(--text-faint)]">({e.doc})</span>
                  </li>
                ))}
              </ul>
              {res.avisos.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  {res.avisos.map((a, i) => (
                    <li key={i}>⚠ {a}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Onde salvar</h2>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="radio" checked={destino === 'novo'} onChange={() => setDestino('novo')} /> Criar um condomínio novo (como rascunho)
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={destino !== 'novo'} onChange={() => setDestino(condos[0]?.id ?? 'novo')} disabled={!condos.length} /> Atualizar só a tabela (tipologias e preços) de:
                </label>
                <select className={`${inputClass} w-auto`} value={destino === 'novo' ? '' : destino} onChange={(e) => setDestino(e.target.value || 'novo')}>
                  <option value="">— escolha —</option>
                  {condos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.bairro ? ` · ${c.bairro}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {existente && norm(existente.name) === norm(f.nome) && (
                <p className="mt-2 text-xs text-[var(--text-muted)]">Já existe um condomínio com este nome — por isso a atualização da tabela foi pré-selecionada. Fotos, descrição e endereço dele não mudam.</p>
              )}
            </section>

            {destino === 'novo' && (
              <section className="grid gap-3 rounded-2xl border border-[var(--border)] p-4 md:grid-cols-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] md:col-span-2">Dados do condomínio</h2>
                <label className="text-xs font-semibold text-[var(--text-muted)] md:col-span-2">
                  Nome
                  <input className={inputClass} value={f.nome} onChange={(e) => set('nome', e.target.value)} />
                </label>
                <label className="text-xs font-semibold text-[var(--text-muted)] md:col-span-2">
                  Endereço (rua, quadra, lote)
                  <input className={inputClass} value={f.logradouro} onChange={(e) => set('logradouro', e.target.value)} />
                </label>
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Bairro
                  <input className={inputClass} value={f.bairro} onChange={(e) => set('bairro', e.target.value)} />
                </label>
                <div className="grid grid-cols-[1fr_70px] gap-2">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    Cidade
                    <input className={inputClass} value={f.cidade} onChange={(e) => set('cidade', e.target.value)} />
                  </label>
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    UF
                    <input className={inputClass} maxLength={2} value={f.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} />
                  </label>
                </div>
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  CEP
                  <input className={inputClass} value={f.cep} onChange={(e) => set('cep', e.target.value)} placeholder="opcional" />
                </label>
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Previsão de entrega *
                  <input type="month" className={inputClass} value={f.entrega} onChange={(e) => set('entrega', e.target.value)} />
                </label>
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Tipo
                  <select className={inputClass} value={f.tipo} onChange={(e) => set('tipo', e.target.value as 'vertical' | 'horizontal')}>
                    <option value="vertical">Vertical (prédio)</option>
                    <option value="horizontal">Horizontal (casas/lotes)</option>
                  </select>
                </label>
                {f.tipo === 'vertical' && (
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    Pavimentos
                    <input type="number" className={inputClass} value={f.pavimentos} onChange={(e) => set('pavimentos', e.target.value)} />
                  </label>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-[var(--border)] p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Tipologias ({tips.filter((t) => t.incluir).length})</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Agrupadas pela metragem da tabela. O preço é o menor valor entre as unidades disponíveis (&quot;a partir de&quot;).</p>
              <div className="mt-3 space-y-3">
                {tips.map((t, i) => (
                  <div key={i} className={`rounded-xl border p-3 ${t.incluir ? 'border-[var(--border)]' : 'border-dashed border-[var(--border)] opacity-60'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-sm font-semibold">
                        <input type="checkbox" checked={t.incluir} onChange={(e) => setTip(i, { incluir: e.target.checked })} /> Incluir
                      </label>
                      <select className={`${inputClass} w-auto`} value={t.tipoUnidade} onChange={(e) => setTip(i, { tipoUnidade: e.target.value as TipoUnidade })}>
                        {TIPO_UNIDADE_GRUPOS.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.tipos.map((tp) => (
                              <option key={tp} value={tp}>
                                {TIPO_UNIDADE_LABEL[tp]}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <span className="text-xs text-[var(--text-muted)]">{t.info}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                        Área (m²)
                        <input className={inputClass} value={t.area} onChange={(e) => setTip(i, { area: e.target.value.replace(/[^\d,]/g, '') })} />
                      </label>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                        Quartos/suítes
                        <input className={`${inputClass} ${!t.quartos ? 'border-amber-400' : ''}`} inputMode="numeric" value={t.quartos} onChange={(e) => setTip(i, { quartos: e.target.value.replace(/\D/g, '') })} />
                      </label>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                        Vagas
                        <input className={inputClass} inputMode="numeric" value={t.vagas} onChange={(e) => setTip(i, { vagas: e.target.value.replace(/\D/g, '') })} />
                      </label>
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                        A partir de
                        <input className={inputClass} inputMode="numeric" value={maskCurrencyInput(t.precoDigits)} onChange={(e) => setTip(i, { precoDigits: e.target.value.replace(/\D/g, '') })} />
                      </label>
                    </div>
                  </div>
                ))}
                {!tips.length && <p className="text-sm text-[var(--text-muted)]">Nenhuma tipologia encontrada — dá para cadastrar depois na tela do condomínio.</p>}
              </div>
            </section>

            {destino === 'novo' && (
              <>
                <section className="rounded-2xl border border-[var(--border)] p-4">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Lazer e comodidades</h2>
                  <AmenitiesCheckboxes selected={amenities} onChange={setAmenities} />
                </section>

                <section className="rounded-2xl border border-[var(--border)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Descrição (SEO)</h2>
                    <button type="button" onClick={regerarDescricao} className="text-xs font-semibold text-accent hover:underline">
                      Refazer com os dados acima
                    </button>
                  </div>
                  <DescriptionEditor label="Narrativa" value={descricao} onChange={setDescricao} rows={14} hint="Texto montado só com os fatos lidos dos PDFs. Ajuste à vontade." />
                </section>
              </>
            )}

            {erro && <p className="text-sm font-semibold text-red-600">{erro}</p>}
            {destino === 'novo' && !f.entrega && tips.some((t) => t.incluir) && (
              <p className="text-xs text-amber-800">Sem data de entrega as tipologias ficam para depois (a entrega é usada nelas). O condomínio é salvo como rascunho do mesmo jeito.</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={salvando} onClick={salvar} className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
                {salvando ? 'Salvando…' : destino === 'novo' ? 'Criar rascunho e revisar' : 'Atualizar tabela'}
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                {destino === 'novo' ? 'Depois você adiciona fotos e vídeo e publica na tela do condomínio.' : 'As tipologias antigas que não estão na nova tabela saem do site.'}
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { extrairAnuncio } from '@/lib/anuncio-parser';
import { lerPdf, extrairImagensPdf, renderizarPaginas } from '@/lib/pdf-import/extract';
import { uploadOne, imagensDoEvento } from '@/components/PhotoUploadField';
import { formatLocation } from '@/components/CepField';
import { listCondominios, type PropertyEditData } from '@/lib/actions';
import { semAcento } from '@/lib/pdf-import/parse';

type Img = { src: string; blob: Blob; usar: boolean; origem: string };

type TesseractGlobal = { recognize: (img: Blob | string, lang: string) => Promise<{ data: { text: string } }> };

// OCR (ler texto de print) sem IA: Tesseract, carregado só quando precisa
function carregarTesseract(): Promise<TesseractGlobal> {
  const w = window as unknown as { Tesseract?: TesseractGlobal };
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => ((window as unknown as { Tesseract?: TesseractGlobal }).Tesseract ? resolve((window as unknown as { Tesseract: TesseractGlobal }).Tesseract) : reject(new Error('OCR indisponível')));
    s.onerror = () => reject(new Error('Não foi possível carregar o leitor de prints.'));
    document.head.appendChild(s);
  });
}

const norm = (s?: string | null) => semAcento((s ?? '').toLowerCase()).replace(/[^a-z0-9]/g, '');

// "Preenchimento rápido": cola o texto do anúncio, manda o PDF ou um print —
// o formulário abaixo já vem preenchido (inclusive a descrição formatada e as fotos do PDF).
export default function PreenchimentoRapido({ onAplicar }: { onAplicar: (d: PropertyEditData, resumo: string[]) => void }) {
  const [texto, setTexto] = useState('');
  const [imgs, setImgs] = useState<Img[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(true);
  const pdfRef = useRef<HTMLInputElement | null>(null);
  const printRef = useRef<HTMLInputElement | null>(null);

  const addTexto = (t: string) => setTexto((cur) => (cur.trim() ? `${cur.trim()}\n\n${t.trim()}` : t.trim()));

  const lerPdfs = async (files: File[]) => {
    setErro(null);
    for (const f of files) {
      try {
        setStatus(`Lendo ${f.name}…`);
        const doc = await lerPdf(f, f.name, (p, t) => setStatus(`Lendo ${f.name} — página ${p} de ${t}`));
        const txt = doc.paginas.map((pg) => pg.join('\n')).join('\n\n');
        if (txt.replace(/\s/g, '').length > 20) addTexto(txt);
        setStatus(`Separando as fotos de ${f.name}…`);
        let fotos = await extrairImagensPdf(f);
        let origem = 'foto do PDF';
        if (!fotos.length) {
          // PDF "achatado": usa as páginas inteiras como imagem (até 12)
          fotos = await renderizarPaginas(f, Array.from({ length: Math.min(doc.paginas.length, 12) }, (_, i) => i + 1), undefined, 2000);
          origem = 'página do PDF';
        }
        setImgs((cur) => [...cur, ...fotos.map((blob) => ({ src: URL.createObjectURL(blob), blob, usar: origem === 'foto do PDF', origem }))]);
        if (txt.replace(/\s/g, '').length <= 20) setErro(`"${f.name}" não tem texto selecionável — se for um print/scan, use "Ler print".`);
      } catch {
        setErro(`Não foi possível abrir "${f.name}".`);
      }
    }
    setStatus(null);
  };

  const lerPrints = async (files: File[]) => {
    setErro(null);
    try {
      setStatus('Carregando o leitor de prints…');
      const T = await carregarTesseract();
      for (const [i, f] of files.entries()) {
        setStatus(`Lendo o texto do print ${i + 1} de ${files.length}… (pode levar alguns segundos)`);
        const { data } = await T.recognize(f, 'por');
        if (data.text.trim()) addTexto(data.text);
        setImgs((cur) => [...cur, { src: URL.createObjectURL(f), blob: f, usar: false, origem: 'print' }]);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler o print.');
    }
    setStatus(null);
  };

  const aplicar = async () => {
    setErro(null);
    if (!texto.trim() && !imgs.some((i) => i.usar)) return setErro('Cole o texto do anúncio, envie um PDF ou um print.');
    const r = extrairAnuncio(texto);
    setStatus('Enviando as fotos escolhidas…');
    const usadas = imgs.filter((i) => i.usar);
    const nomeArq = [r.condominio, r.tipoUnidade, r.bairro].filter(Boolean).join(' ');
    const fotos: string[] = [];
    for (const [k, im] of usadas.entries()) {
      setStatus(`Enviando foto ${k + 1} de ${usadas.length}…`);
      try {
        fotos.push(await uploadOne(new File([im.blob], `foto-${k + 1}.jpg`, { type: im.blob.type || 'image/jpeg' }), 'imoveis', nomeArq));
      } catch {
        /* segue com as outras */
      }
    }
    // Condomínio com o mesmo nome e cidade já cadastrado? Já vincula.
    let empreendimentoId: string | undefined;
    if (r.condominio) {
      const lista = await listCondominios().catch(() => []);
      const nomeSemPrefixo = (n: string) => norm(n.replace(/^(condom[ií]nio|residencial|edif[ií]cio)\s+/i, ''));
      const igual = lista.find((c) => nomeSemPrefixo(c.name) === nomeSemPrefixo(r.condominio!) && (!r.cidade || norm(c.cidade) === norm(r.cidade)));
      if (igual) empreendimentoId = igual.id;
    }
    setStatus(null);
    const d: PropertyEditData = {
      id: '',
      corretorEmail: null,
      titulo: r.titulo,
      tipoUnidade: r.tipoUnidade ?? 'apartamento',
      finalidade: r.finalidade ?? 'venda',
      deliveryDate: r.deliveryDate ?? '',
      priceValue: r.priceValue ?? 0,
      pricePeriod: r.pricePeriod ?? (r.finalidade === 'aluguel' ? 'mensal' : 'unico'),
      location: formatLocation({ cep: r.cep ?? '', logradouro: r.logradouro ?? '', bairro: r.bairro ?? '', cidade: r.cidade ?? '', uf: r.uf ?? '' }),
      quartos: r.quartos,
      vagas: r.vagas,
      banheiros: r.banheiros,
      area: r.area,
      video: false,
      aceitaTemporada: !!r.aceitaTemporada,
      description: r.description,
      amenities: r.amenities,
      photos: fotos,
      cep: r.cep,
      logradouro: r.logradouro,
      bairro: r.bairro,
      cidade: r.cidade,
      uf: r.uf,
      condominio: r.condominio,
      empreendimentoId,
      visibilidade: 'publico'
    };
    const resumo = [...r.encontrados, fotos.length ? `${fotos.length} foto(s)` : ''].filter(Boolean);
    onAplicar(d, resumo);
    setAberto(false);
  };

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="mb-5 text-sm font-semibold text-accent hover:underline">
        ↺ Usar o preenchimento rápido de novo
      </button>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border-2 border-dashed border-accent/50 bg-[#f5f8ff] p-4">
      <h2 className="text-base font-bold">Preenchimento rápido</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Cole o texto do anúncio, envie o PDF (texto e fotos) ou um print da tela — o formulário abaixo já vem preenchido para você conferir. Use textos seus ou do
        proprietário (nunca copie descrição de anúncio de outro corretor). Telefones, e-mails e links saem da descrição automaticamente.
      </p>
      <textarea
        className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-accent"
        rows={7}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onPaste={(e) => {
          const prints = imagensDoEvento(e.clipboardData);
          if (prints.length) {
            e.preventDefault();
            lerPrints(prints);
          }
        }}
        placeholder={'Cole aqui o anúncio completo (Ctrl+V). Ex.:\nApartamento à venda no Setor Bueno — 3 suítes, 142 m², 3 vagas\nValor: R$ 1.290.000\nCondomínio Porto Belo…\n\nColou um print? Ele é lido automaticamente.'}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => pdfRef.current?.click()} className="rounded-full bg-[var(--bg)] px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-accent">
          Enviar PDF
        </button>
        <button type="button" onClick={() => printRef.current?.click()} className="rounded-full bg-[var(--bg)] px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-accent">
          Ler print (imagem)
        </button>
        <input ref={pdfRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; lerPdfs(f); }} />
        <input ref={printRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; lerPrints(f); }} />
      </div>

      {imgs.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">Imagens encontradas — marque as que vão para as fotos do anúncio ({imgs.filter((i) => i.usar).length})</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {imgs.map((im, i) => (
              <button
                key={im.src}
                type="button"
                onClick={() => setImgs((cur) => cur.map((x, j) => (j === i ? { ...x, usar: !x.usar } : x)))}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 ${im.usar ? 'border-accent' : 'border-transparent opacity-50'}`}
                title={im.origem}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.src} alt="" className="h-full w-full object-cover" />
                <span className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${im.usar ? 'bg-accent text-white' : 'bg-white/90 text-ink'}`}>
                  {im.usar ? '✓' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {status && <p className="mt-3 text-xs font-semibold text-accent">{status}</p>}
      {erro && <p className="mt-3 text-xs font-semibold text-red-600">{erro}</p>}
      <button type="button" disabled={!!status} onClick={aplicar} className="mt-3 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
        Preencher o formulário
      </button>
    </section>
  );
}

// Leitura do texto dos PDFs NO NAVEGADOR (o arquivo não sobe para o servidor —
// o book costuma ter 10+ MB, acima do limite da Vercel). Remonta as linhas a
// partir da posição de cada pedaço de texto, parecido com o "pdftotext -layout":
// colunas de tabela ficam separadas por 2+ espaços.

export type PdfDoc = { nome: string; paginas: string[][] };

type Item = { str: string; x: number; y: number; w: number; h: number };

export function montarLinhas(items: Item[]): string[] {
  const vis = items.filter((i) => i.str.trim());
  if (!vis.length) return [];
  // agrupa por altura (y) com tolerância de meia linha
  const sorted = [...vis].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: Item[][] = [];
  for (const it of sorted) {
    const tol = Math.max(2, (it.h || 8) * 0.5);
    const alvo = linhas.find((l) => Math.abs(l[0].y - it.y) <= tol);
    if (alvo) alvo.push(it);
    else linhas.push([it]);
  }
  linhas.sort((a, b) => b[0].y - a[0].y);
  return linhas.map((l) => {
    l.sort((a, b) => a.x - b.x);
    let out = '';
    let fim = -Infinity;
    for (const it of l) {
      const charW = it.str.length ? it.w / it.str.length : 5;
      const gap = it.x - fim;
      if (out) {
        if (gap > Math.max(charW * 1.6, 6)) out += '   ';
        else if (gap > charW * 0.15 && !out.endsWith(' ') && !it.str.startsWith(' ')) out += ' ';
      }
      out += it.str;
      fim = it.x + it.w;
    }
    return out.replace(/\s+$/, '');
  });
}

// PDFs grandes (books de 100+ MB): o arquivo é aberto direto do disco pelo
// navegador e lido página por página, só o texto (as imagens não são
// decodificadas), com progresso para a tela.
export async function lerPdf(
  arquivo: File | ArrayBuffer | Uint8Array,
  nome = 'arquivo.pdf',
  onProgresso?: (pagina: number, total: number) => void
): Promise<PdfDoc> {
  const pdfjs = await carregarPdfJs();
  const bytes =
    arquivo instanceof Uint8Array ? new Uint8Array(arquivo) : arquivo instanceof ArrayBuffer ? new Uint8Array(arquivo) : new Uint8Array(await (arquivo as File).arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const paginas: string[][] = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const items: Item[] = (tc.items as { str?: string; transform?: number[]; width?: number; height?: number }[])
        .filter((i) => typeof i.str === 'string' && i.transform)
        .map((i) => ({ str: i.str as string, x: i.transform![4], y: i.transform![5], w: i.width ?? 0, h: i.height ?? Math.abs(i.transform![3]) }));
      paginas.push(montarLinhas(items));
      page.cleanup();
      onProgresso?.(p, pdf.numPages);
      // devolve o controle ao navegador a cada 10 páginas (tela não trava)
      if (p % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    await pdf.destroy();
  }
  return { nome: arquivo instanceof File ? arquivo.name : nome, paginas };
}

// PDF.js completo servido em /pdfjs (public/pdfjs, versão 4.10.38 "legacy"):
// fica fora do bundle do Next e decodifica imagens JPEG 2000, muito usadas em
// cadernos de plantas (numa versão enxuta a planta saía em branco).
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array; isEvalSupported?: boolean }) => { promise: Promise<PdfJsDoc> };
};
type PdfJsDoc = {
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: unknown) => { promise: Promise<void> };
    getTextContent: () => Promise<{ items: unknown[] }>;
    cleanup: () => void;
  }>;
  numPages: number;
  destroy: () => Promise<void>;
};
let pdfjsPromise: Promise<PdfJs> | null = null;
function carregarPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (import(/* webpackIgnore: true */ '/pdfjs/pdf.min.mjs' as string) as Promise<PdfJs>).then((m) => {
      m.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      return m;
    });
  }
  return pdfjsPromise;
}

/** Transforma páginas do PDF em imagens JPEG (planta), maior lado ~2400 px. */
export async function renderizarPaginas(
  arquivo: File,
  paginas: number[],
  onPronta?: (indice: number, blob: Blob) => void,
  maiorLado = 2400
): Promise<Blob[]> {
  const pdfjs = await carregarPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()), isEvalSupported: false }).promise;
  const out: Blob[] = [];
  try {
    for (const [i, n] of paginas.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const page = await pdf.getPage(n).catch(() => null);
      if (!page) continue;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(4, maiorLado / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
      if (blob) {
        out.push(blob);
        onPronta?.(i, blob);
      }
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }
  return out;
}

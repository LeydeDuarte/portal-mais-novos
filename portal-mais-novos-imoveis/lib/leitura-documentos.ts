// Leitura automática (sem IA, tudo no navegador) do documento de identidade
// (RG, CNH, CNH digital) e do comprovante de endereço, para preencher a proposta.
// PDF com texto → PDF.js; foto ou PDF escaneado → OCR (Tesseract, em português).
// Nada aqui é enviado a terceiros: o texto só serve para sugerir os campos, que a
// pessoa confere e corrige antes de enviar.
import { lerPdf, renderizarPaginas } from './pdf-import/extract';

type TesseractGlobal = { recognize: (img: Blob | string, lang: string) => Promise<{ data: { text: string } }> };

function carregarTesseract(): Promise<TesseractGlobal> {
  const w = window as unknown as { Tesseract?: TesseractGlobal };
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => {
      const t = (window as unknown as { Tesseract?: TesseractGlobal }).Tesseract;
      if (t) resolve(t);
      else reject(new Error('Leitor indisponível'));
    };
    s.onerror = () => reject(new Error('Não foi possível carregar o leitor de documentos.'));
    document.head.appendChild(s);
  });
}

const ehPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** Texto do arquivo (PDF ou imagem). */
export async function textoDoArquivo(f: File): Promise<string> {
  if (ehPdf(f)) {
    const doc = await lerPdf(f, f.name);
    const texto = doc.paginas.slice(0, 3).flat().join('\n');
    if (texto.replace(/\s/g, '').length > 40) return texto;
    // PDF escaneado (só imagem): transforma a 1ª página em foto e lê
    const [img] = await renderizarPaginas(f, [1], undefined, 2000);
    if (!img) return '';
    const T = await carregarTesseract();
    return (await T.recognize(img, 'por')).data.text;
  }
  const T = await carregarTesseract();
  return (await T.recognize(f, 'por')).data.text;
}

// ---------------- Regras ----------------
const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export { cpfValido } from './leitura-documentos-servidor';
import { cpfValido } from './leitura-documentos-servidor';
export const formatarCpf = (d: string) => d.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').replace(/-$/, '');

function acharCpf(texto: string): string | null {
  const candidatos = texto.match(/\d{3}[.\s]?\d{3}[.\s]?\d{3}\s?[-–.]?\s?\d{2}/g) ?? [];
  for (const c of candidatos) if (cpfValido(c)) return formatarCpf(c);
  return null;
}

function datas(texto: string): { iso: string; ano: number }[] {
  return (texto.match(/\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b/g) ?? [])
    .map((t) => {
      const [d, m, a] = t.split(/[/.-]/).map(Number);
      return d >= 1 && d <= 31 && m >= 1 && m <= 12 && a > 1900 && a <= new Date().getFullYear() ? { iso: `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, ano: a } : null;
    })
    .filter((x): x is { iso: string; ano: number } => !!x);
}

// Linha com cara de nome de pessoa: só letras, 2+ palavras, sem palavras de formulário
const PALAVRAS_FORM = /(republica|federativa|brasil|ministerio|departamento|transito|carteira|nacional|habilitacao|identidade|registro|geral|secretaria|seguranca|publica|estado|filiacao|nome|data|nascimento|validade|assinatura|documento|cpf|naturalidade|orgao|emissor|expedicao|categoria|permissao|observacoes|local|goias|goiania|detran|policia|civil|instituto|valida|todo|territorio)/;
function pareceNome(linha: string): boolean {
  const l = semAcento(linha.trim());
  if (!/^[A-Za-z' ]{6,70}$/.test(l)) return false;
  const palavras = l.split(/\s+/).filter(Boolean);
  if (palavras.length < 2 || palavras.length > 8) return false;
  return !PALAVRAS_FORM.test(l.toLowerCase());
}
const titulo = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)(\p{L})/gu, (m, esp, l) => esp + l.toUpperCase())
    .replace(/\s(Da|De|Do|Das|Dos|E)\s/g, (m) => m.toLowerCase());

export type DadosIdentidade = { nome?: string; cpf?: string; rg?: string; nascimento?: string };

export function lerIdentidade(texto: string): DadosIdentidade {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: DadosIdentidade = {};
  const cpf = acharCpf(texto);
  if (cpf) out.cpf = cpf;

  // Nome: a linha logo depois do rótulo "NOME" (RG e CNH), senão a 1ª linha com cara de nome
  for (let i = 0; i < linhas.length; i++) {
    const l = semAcento(linhas[i]).toLowerCase();
    if (/^(\d+\s*)?nome( e sobrenome| civil| social)?\s*:?\s*$/.test(l) || /^nome\s*:/.test(l)) {
      const mesmaLinha = linhas[i].split(':')[1]?.trim();
      const cand = mesmaLinha && pareceNome(mesmaLinha) ? mesmaLinha : linhas.slice(i + 1, i + 3).find(pareceNome);
      if (cand) {
        out.nome = titulo(cand);
        break;
      }
    }
  }
  if (!out.nome) {
    const c = linhas.find(pareceNome);
    if (c) out.nome = titulo(c);
  }

  // Nascimento: data perto do rótulo; senão a data mais antiga (as outras são emissão/validade)
  const idx = linhas.findIndex((l) => /nascimento/i.test(semAcento(l)));
  const perto = idx >= 0 ? datas(linhas.slice(idx, idx + 3).join(' ')) : [];
  const todas = datas(texto).sort((a, b) => a.ano - b.ano);
  const nasc = perto[0] ?? todas.find((d) => d.ano < new Date().getFullYear() - 16);
  if (nasc) out.nascimento = nasc.iso;

  // RG: número perto de "registro geral"/"RG"/"identidade"
  const rgLinha = linhas.findIndex((l) => /(registro geral|\brg\b|identidade|doc\.? identidade)/i.test(semAcento(l)));
  if (rgLinha >= 0) {
    const trecho = linhas.slice(rgLinha, rgLinha + 3).join(' ');
    const m = trecho.match(/\b(\d{1,2}\.?\d{3}\.?\d{3}(-?[\dxX])?)\b/);
    if (m && m[1].replace(/\D/g, '') !== (out.cpf ?? '').replace(/\D/g, '')) out.rg = m[1];
  }
  return out;
}

export type DadosEndereco = { cep?: string; endereco?: string };

export function lerComprovante(texto: string): DadosEndereco {
  const out: DadosEndereco = {};
  const cep = texto.match(/\b(\d{5})[-.\s]?(\d{3})\b/);
  if (cep) out.cep = `${cep[1]}${cep[2]}`;
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rua = linhas.find((l) => /^(rua|r\.|av\.?|avenida|alameda|al\.|travessa|tv\.|rodovia|estrada|praca|praça|quadra|qd\.?)\s/i.test(semAcento(l)));
  if (rua) out.endereco = rua.replace(/\s+/g, ' ').slice(0, 160);
  return out;
}

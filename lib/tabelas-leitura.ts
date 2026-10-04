'use client';

// Leitura de tabelas de vendas NO NAVEGADOR (grátis, sem IA): PDF pelas regras do
// "Importar PDFs", planilha (xlsx/csv) pelo cabeçalho, ZIP aberto na hora.
// Descobre o mês de referência e o empreendimento (pelo nome no arquivo, na pasta ou no texto).
import { lerTabelaGenerica, mesDaTabela } from './tabelas-pdf';
import { lerPdf } from './pdf-import/extract';
import { lerTabela, parseMesAno, semAcento, type UnidadeTabela } from './pdf-import/parse';

export type ArquivoTabela = { caminho: string; nome: string; dados: Blob };
export type TabelaLida = {
  caminho: string;
  unidades: UnidadeTabela[];
  mes: string | null; // AAAA-MM
  texto: string; // começo do arquivo (para achar o nome do empreendimento)
  hash: string;
  erro?: string;
};

const EXT = /\.(pdf|xlsx|xls|csv)$/i;

/** Abre ZIPs e devolve só os arquivos de tabela (pdf, xlsx, csv), com o caminho da pasta. */
export async function expandirArquivos(lista: File[]): Promise<ArquivoTabela[]> {
  const out: ArquivoTabela[] = [];
  for (const f of lista) {
    const caminho = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    if (/\.zip$/i.test(f.name)) {
      const { unzipSync } = await import('fflate');
      const conteudo = unzipSync(new Uint8Array(await f.arrayBuffer()), { filter: (a) => EXT.test(a.name) && !/__MACOSX|\/\./.test(a.name) });
      for (const [nome, bytes] of Object.entries(conteudo)) out.push({ caminho: `${caminho.replace(/\.zip$/i, '')}/${nome}`, nome: nome.split('/').pop() ?? nome, dados: new Blob([bytes]) });
    } else if (EXT.test(f.name)) out.push({ caminho, nome: f.name, dados: f });
  }
  return out;
}

async function hashDe(b: Blob): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', await b.arrayBuffer());
  return Array.from(new Uint8Array(d))
    .slice(0, 16)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

const norm = (s: string) => semAcento(String(s ?? '').toLowerCase()).trim();

/** Número em formato brasileiro ou não: "1.150.000,00", "98,5", "120", "890000", "R$ 1.2 mi" não. */
function numeroBR(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  let t = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (!t) return undefined;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); // vírgula decimal: pontos são milhar
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // só pontos de milhar
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Planilha: acha a linha de cabeçalho (unidade / área / valor) e lê as linhas abaixo. */
function lerLinhasPlanilha(linhas: unknown[][]): UnidadeTabela[] {
  const achar = (cab: string[], re: RegExp) => cab.findIndex((c) => re.test(c));
  for (let h = 0; h < Math.min(linhas.length, 40); h++) {
    const cab = (linhas[h] ?? []).map((c) => norm(String(c ?? '')));
    const iU = achar(cab, /^(unid|apto|apart|apt|casa|lote|n[ºo°.]?\s*(da\s*)?unid)/);
    const iA = achar(cab, /(area|metragem|m2|m²|privativ)/);
    const iV = achar(cab, /(valor|preco|total|a vista)/);
    if (iU < 0 || iA < 0 || iV < 0) continue;
    const iVg = achar(cab, /(vaga|garag|box)/);
    const iS = achar(cab, /(situac|status|disponib)/);
    const iEsc = achar(cab, /(escaninho|deposito|hobby)/);
    const iT = achar(cab, /^(torre|bloco|quadra)/);
    // revenda: coluna com o empreendimento de cada unidade
    const iEmp = cab.findIndex((c, k) => k !== iU && /(empreendimento|condominio|edificio|residencial|produto|obra|predio)/.test(c));
    const out: UnidadeTabela[] = [];
    for (const l of linhas.slice(h + 1)) {
      const un = String(l?.[iU] ?? '').trim();
      const area = numeroBR(String(l?.[iA] ?? '').replace(/m.?2|m²/gi, ''));
      const valor = numeroBR(l?.[iV]);
      if (!un || !area || area < 15 || area > 5000) continue;
      const st = norm(String(iS >= 0 ? l?.[iS] ?? '' : ''));
      // garagens: "17, 18" / "17 e 18" = números das vagas (guarda o texto e conta);
      // um número sozinho pequeno (até 9) = quantidade de vagas
      const g = iVg >= 0 ? String(l?.[iVg] ?? '').trim() : '';
      const partes = g.split(/\s*(?:,|;|\/|\be\b)\s*/i).filter((x) => /\d/.test(x));
      const soQuantidade = partes.length === 1 && /^\d$/.test(partes[0]) && !/[,;\/e]/i.test(g);
      out.push({
        unidade: un,
        area,
        valor: valor && valor >= 30000 ? valor : undefined,
        vagas: g ? (soQuantidade ? Number(partes[0]) : partes.length || undefined) : undefined,
        garagens: g && !soQuantidade ? g : undefined,
        escaninho: iEsc >= 0 ? String(l?.[iEsc] ?? '').trim() || undefined : undefined,
        torre: iT >= 0 ? String(l?.[iT] ?? '').trim() || undefined : undefined,
        empreendimento: iEmp >= 0 ? String(l?.[iEmp] ?? '').trim() || undefined : undefined,
        situacao: /vend/.test(st) ? 'vendida' : /reserv/.test(st) ? 'reservada' : 'disponivel'
      });
    }
    if (out.length) return out;
  }
  return [];
}

export async function lerArquivoTabela(a: ArquivoTabela): Promise<TabelaLida> {
  const hash = await hashDe(a.dados);
  const base = { caminho: a.caminho, hash };
  try {
    if (/\.pdf$/i.test(a.nome)) {
      const doc = await lerPdf(await a.dados.arrayBuffer(), a.nome);
      const texto = doc.paginas.slice(0, 2).flat().join('\n').slice(0, 4000);
      // leitura genérica (qualquer incorporadora); a antiga fica de reserva se ler mais
      const generica = lerTabelaGenerica(doc);
      const antiga = generica.length ? [] : lerTabela(doc);
      const unidades = generica.length >= antiga.length ? generica : antiga;
      const mes = mesDaTabela(a.caminho, texto) ?? parseMesAno(texto) ?? null;
      return { ...base, unidades, mes, texto, erro: unidades.length ? undefined : 'Não reconheci as linhas de unidade deste PDF.' };
    }
    let linhas: unknown[][];
    if (/\.csv$/i.test(a.nome)) {
      const t = await a.dados.text();
      const sep = (t.split('\n')[0].match(/;/g) ?? []).length >= (t.split('\n')[0].match(/,/g) ?? []).length ? ';' : ',';
      linhas = t.split(/\r?\n/).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, '').trim()));
    } else {
      const { default: lerPlanilha } = await import('read-excel-file');
      linhas = (await lerPlanilha(a.dados)) as unknown[][];
    }
    const texto = linhas
      .slice(0, 12)
      .map((l) => l.join(' '))
      .join('\n');
    const unidades = lerLinhasPlanilha(linhas);
    const mes = mesDaTabela(a.caminho, texto) ?? parseMesAno(texto) ?? null;
    return { ...base, unidades, mes, texto, erro: unidades.length ? undefined : 'Não achei as colunas de unidade, área e valor.' };
  } catch (e) {
    return { ...base, unidades: [], mes: null, texto: '', erro: e instanceof Error ? e.message : 'Não foi possível ler.' };
  }
}

/** Empreendimento pelo nome: procura os nomes cadastrados no caminho (pasta + arquivo) e no texto.
 *  Vale o nome inteiro ou o COMEÇO do nome quando o resto é sobrenome de marca ("Elements" acha
 *  "Elements Consciente"; "Maestro" acha "Maestro Residenza"). Só liga sozinho sem empate. */
const SOBRENOME_MARCA = /^(by|consciente|opus|residenza|residencias|residencia|residence|residences|residencial|home|homes|authentic|club|clube|tower|towers|prime|exclusive|living|house)$/;
export function acharEmpreendimento(t: TabelaLida, nomes: { id: string; nome: string }[]): { id: string; nome: string } | null {
  const alvo = ` ${norm(`${t.caminho} ${t.texto}`).replace(/[^a-z0-9]+/g, ' ')} `;
  const noArquivo = ` ${norm(t.caminho).replace(/[^a-z0-9]+/g, ' ')} `;
  const limpar = (n: string) => norm(n).replace(/^(edificio|residencial|condominio)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  let melhor: { id: string; nome: string; tam: number } | null = null;
  let empate = false;
  for (const n of nomes) {
    const palavras = limpar(n.nome).split(' ').filter(Boolean);
    if (!palavras.length) continue;
    // maior começo do nome que aparece no arquivo/texto
    let k = 0;
    for (let j = palavras.length; j >= 1; j--) {
      if (alvo.includes(` ${palavras.slice(0, j).join(' ')} `)) {
        k = j;
        break;
      }
    }
    if (!k) continue;
    const achado = palavras.slice(0, k).join(' ');
    if (achado.length < 4) continue;
    // nome incompleto: só vale se o que falta é sobrenome de marca E se estiver no nome do arquivo
    // (no texto do PDF, "Setor Marista" não pode virar "Marista Prime Residence")
    if (k < palavras.length && (!palavras.slice(k).every((p) => SOBRENOME_MARCA.test(p)) || !noArquivo.includes(` ${achado} `))) continue;
    if (!melhor || achado.length > melhor.tam) {
      melhor = { id: n.id, nome: n.nome, tam: achado.length };
      empate = false;
    } else if (achado.length === melhor.tam && n.id !== melhor.id) empate = true;
  }
  return melhor && !empate ? { id: melhor.id, nome: melhor.nome } : null;
}

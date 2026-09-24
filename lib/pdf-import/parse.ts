// Leitura por REGRAS (sem IA) dos materiais de lançamento: ficha técnica,
// tabela de vendas, caderno de plantas e book. Cada incorporadora monta os
// arquivos de um jeito, então as regras procuram padrões comuns ("Endereço:",
// "Prazo de entrega", linhas da tabela começando pela unidade + área + valor…)
// e tudo passa por uma tela de conferência antes de salvar.

import type { PdfDoc } from './extract';
import type { TipoUnidade } from '@/lib/tipologias';
import { AMENIDADES_PADRAO } from '@/lib/amenidades';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { formatTitulo } from '@/lib/text';

export type TipoDoc = 'tabela' | 'ficha' | 'plantas' | 'book' | 'outro';

export type UnidadeTabela = {
  unidade: string;
  area: number;
  valor?: number;
  vagas?: number;
  situacao: 'disponivel' | 'vendida' | 'reservada' | 'outra';
};

export type TipologiaImport = {
  tipoUnidade: TipoUnidade;
  area: number;
  quartos?: number;
  vagas?: number;
  precoMin?: number;
  precoMax?: number;
  disponiveis: number;
  total: number;
  unidades: string[];
  rotulo?: string; // ex.: "varanda gourmet", "Tipo 2"
};

export type ImportResult = {
  nome: string;
  construtora?: string;
  endereco: { logradouro: string; bairro: string; cidade: string; uf: string; cep: string };
  entrega?: string; // AAAA-MM
  pavimentos?: number;
  torres?: string;
  totalUnidades?: number;
  areaTerreno?: string;
  tipo: 'vertical' | 'horizontal';
  amenities: string[];
  destaquesLazer: string[];
  fichaTecnica: { rotulo: string; valor: string }[];
  tipologias: TipologiaImport[];
  descricao: string;
  docs: { nome: string; tipo: TipoDoc; paginas: number; semTexto: boolean }[];
  encontrados: { campo: string; valor: string; doc: string }[];
  avisos: string[];
};

// ---------- utilitários ----------

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const MESES: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6,
  jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12
};
const MES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** "1.740.812,24" → 1740812.24 ; "998.743,99" → 998743.99 */
export function parseValor(s: string): number | undefined {
  const m = s.match(/\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+,\d{2}/);
  if (!m) return undefined;
  const n = Number(m[0].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** "148,78 m²" → 148.78 ; "2.530,40 m²" → 2530.4 ; "252,5m2" → 252.5 */
export function parseArea(s: string): number | undefined {
  const m = s.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*m(?:²|2)(?![a-z0-9])/i);
  if (!m) return undefined;
  let t = m[1];
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function todasAreas(linha: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*m(?:²|2)(?![a-z0-9])/gi;
  let m;
  while ((m = re.exec(linha))) {
    const a = parseArea(m[0]);
    if (a) out.push(a);
  }
  return out;
}

/** "jun/29", "junho de 2029", "06/2029", "25/06/2029", "dez 2028" → "2029-06" */
export function parseMesAno(s: string): string | undefined {
  const t = semAcento(s.toLowerCase());
  let m = t.match(/\b\d{1,2}\/(\d{1,2})\/(\d{4})\b/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = t.match(/\b([a-z]{3,9})\.?\s*(?:\/|de|-|\s)\s*(\d{4}|\d{2})\b/);
  if (m && MESES[m[1]]) {
    const ano = m[2].length === 2 ? `20${m[2]}` : m[2];
    return `${ano}-${String(MESES[m[1]]).padStart(2, '0')}`;
  }
  m = t.match(/\b(\d{1,2})\/(\d{4})\b/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = t.match(/\b(\d{4})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}`;
  return undefined;
}

export function mesAnoExtenso(aaaamm: string): string {
  const [a, m] = aaaamm.split('-');
  return `${MES_NOME[Number(m) - 1] ?? m} de ${a}`;
}

function brlCurto(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  return `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil`;
}

function areaTxt(a: number): string {
  const frac = Math.round(a * 100) % 100 !== 0;
  return `${a.toLocaleString('pt-BR', { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2 })} m²`;
}

const celulas = (linha: string) => linha.trim().split(/\s{3,}/);

// ---------- classificação dos documentos ----------

const RE_LINHA_UNIDADE = /^\s*(?:(?:apto|apt|unidade|un|casa|lote)\.?\s*)?(\d{1,5}[a-z]?(?:[-/]\d{1,4}[a-z]?)?)\s{2,}.*?\d\s*m(?:²|2)/i;

export function classificarDoc(doc: PdfDoc): TipoDoc {
  const texto = semAcento(doc.paginas.flat().join('\n').toLowerCase());
  const linhasUnidade = doc.paginas.flat().filter((l) => RE_LINHA_UNIDADE.test(l));
  const comValor = linhasUnidade.filter((l) => /\d{1,3}(?:\.\d{3})+,\d{2}/.test(l)).length;
  if (comValor >= 3 || (/\btabela\b/.test(texto) && linhasUnidade.length >= 3)) return 'tabela';
  if (/ficha tecnica/.test(texto)) return 'ficha';
  if (doc.paginas.length >= 30) return 'book';
  if (/(caderno de plantas|planta humanizada|\bplantas?\b)/.test(texto) && /suite|dormit|quarto|m²|m2/.test(texto)) return 'plantas';
  if (doc.paginas.length >= 10) return 'book';
  return 'outro';
}

// ---------- tabela de vendas ----------

function situacaoDe(linha: string): UnidadeTabela['situacao'] {
  const t = semAcento(linha.toLowerCase());
  if (/\bvendid|\bvenda\s+realizada|\bindisponivel/.test(t)) return 'vendida';
  if (/\breservad|\bbloquead|\bpermuta|\bproposta/.test(t)) return 'reservada';
  if (/\bdisponivel|\blivre\b/.test(t)) return 'disponivel';
  return 'outra';
}

const RE_GARAGEM = /^\d+[a-z]?(?:\s*(?:,|\be\b)\s*\d+[a-z]?)+$/i;

function contarVagas(cel: string): number | undefined {
  const t = cel.trim();
  if (!RE_GARAGEM.test(t)) return undefined;
  return t.split(/\s*(?:,|\be\b)\s*/i).filter(Boolean).length;
}

export function lerTabela(doc: PdfDoc): UnidadeTabela[] {
  const out: UnidadeTabela[] = [];
  for (const pag of doc.paginas) {
    pag.forEach((linha, i) => {
      const m = linha.match(RE_LINHA_UNIDADE);
      if (!m) return;
      const cels = celulas(linha);
      const area = parseArea(linha);
      if (!area || area < 15 || area > 5000) return;
      // Valor total: o maior valor em R$ da linha (parcelas são sempre menores)
      const valores = (linha.match(/\d{1,3}(?:\.\d{3})+,\d{2}/g) ?? []).map((v) => parseValor(v)!).filter((v) => v >= 30_000);
      const valor = valores.length ? Math.max(...valores) : undefined;
      // Vagas: célula logo depois da área ("17, 18 e 19"); se a célula quebrou em
      // duas linhas ("216, 217, 218" em cima e "e 219" embaixo), junta as duas.
      const idxArea = cels.findIndex((c) => /m(?:²|2)/i.test(c));
      let vagas = idxArea >= 0 ? contarVagas(cels[idxArea + 1] ?? '') : undefined;
      if (vagas == null) {
        const antes = celulas(pag[i - 1] ?? '')[0] ?? '';
        const depois = celulas(pag[i + 1] ?? '')[0] ?? '';
        if (/^\d+[a-z]?(\s*,\s*\d+[a-z]?)*(\s*,?\s*e)?$/i.test(antes.trim()) && !RE_LINHA_UNIDADE.test(pag[i - 1] ?? ''))
          vagas = contarVagas(`${antes} ${/^(e\s)?\d/i.test(depois.trim()) ? depois : ''}`.replace(/\s+/g, ' '));
      }
      out.push({ unidade: m[1], area, valor, vagas, situacao: situacaoDe(linha) });
    });
  }
  return out;
}

// ---------- ficha técnica (campos "Rótulo: valor") ----------

function acharCampo(linhas: string[], rotulos: RegExp): { valor: string; idx: number } | undefined {
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    const m = l.match(new RegExp(`^(?:[•\\-*]\\s*)?(?:${rotulos.source})\\s*:\\s*(.*)$`, 'i'));
    if (m) {
      let valor = m[1].trim();
      if (!valor && linhas[i + 1]) valor = linhas[i + 1].trim();
      return { valor, idx: i };
    }
  }
  return undefined;
}

export function parseEndereco(bruto: string): ImportResult['endereco'] {
  const e = { logradouro: '', bairro: '', cidade: '', uf: '', cep: '' };
  let s = bruto.replace(/\s+/g, ' ').trim();
  const cep = s.match(/\b(\d{5})-?(\d{3})\b/);
  if (cep) {
    e.cep = `${cep[1]}-${cep[2]}`;
    s = s.replace(/,?\s*(?:cep:?\s*)?\d{5}-?\d{3}\b/i, '');
  }
  // "Goiânia/GO", "Goiânia - GO", "Goiânia – GO"
  const cid = s.match(/,?\s*([A-Za-zÀ-ú' .]+?)\s*(?:\/|-|–)\s*([A-Z]{2})\s*\.?$/);
  if (cid && UFS.includes(cid[2])) {
    e.cidade = cid[1].trim();
    e.uf = cid[2];
    s = s.slice(0, cid.index).trim();
  }
  const partes = s.split(/\s*,\s*|\s+[-–]\s+/).filter(Boolean);
  if (partes.length > 1) {
    const idxB = partes.findIndex((p, i) => i > 0 && /^(setor|st\.?|jardim|jd\.?|bairro|residencial|res\.?|parque|vila|centro|alphaville|condom[ií]nio|loteamento|chácara|park)\b/i.test(p));
    const bi = idxB >= 0 ? idxB : partes.length - 1;
    e.bairro = partes[bi].replace(/^st\.?\s/i, 'Setor ').replace(/^jd\.?\s/i, 'Jardim ');
    e.logradouro = partes.filter((_, i) => i !== bi).join(', ');
  } else e.logradouro = partes[0] ?? '';
  return e;
}

// ---------- nome do empreendimento ----------

const GENERICOS = /^(ficha t[eé]cnica|caderno de plantas|tabela.*|book|[aá]rea de lazer|empreendimento|apartamento( tipo)?|pavimento.*|final \d.*|circula[cç][aã]o|implanta[cç][aã]o|planta.*|lazer|t[eé]rreo|subsolo|garagem.*|\|.*|\d+|p[aá]gina.*|sum[aá]rio|localiza[cç][aã]o|contato.*)$/i;

function acharNome(docs: PdfDoc[]): string | undefined {
  // 1) título da tabela: "TABELA - MARISTA 262 - SETEMBRO/26"
  for (const d of docs)
    for (const l of d.paginas.flat()) {
      const m = l.match(/tabela\s*(?:de vendas)?\s*[-–:]\s*(.+?)\s*[-–]\s*[a-zç]+\s*\/\s*\d{2,4}/i);
      if (m && m[1].length <= 40) return m[1].trim();
    }
  // 2) texto que se repete no rodapé/cabeçalho de várias páginas
  const cont = new Map<string, { n: number; orig: string }>();
  for (const d of docs)
    for (const pag of d.paginas) {
      const vistos = new Set<string>();
      for (const l of pag) {
        const c = celulas(l)[0]?.replace(/^\/\s*/, '').trim() ?? '';
        if (c.length < 3 || c.length > 40 || GENERICOS.test(c) || /^[\d\s.,/-]+$/.test(c)) continue;
        const k = semAcento(c.toLowerCase());
        if (vistos.has(k)) continue;
        vistos.add(k);
        const cur = cont.get(k) ?? { n: 0, orig: c };
        cur.n++;
        cont.set(k, cur);
      }
    }
  const melhor = Array.from(cont.values()).filter((v) => v.n >= 3).sort((a, b) => b.n - a.n)[0];
  if (melhor) return melhor.orig;
  // 3) nome do arquivo
  const f = docs[0]?.nome.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\b(book|ficha|tecnica|técnica|caderno|de|plantas|tabela|compressed|digital|final|\d{1,2})\b/gi, ' ');
  return f?.replace(/\s+/g, ' ').trim() || undefined;
}

// ---------- tipo de unidade a partir das palavras perto da área ----------

function tipoPorTexto(t: string): TipoUnidade | undefined {
  const s = semAcento(t.toLowerCase());
  if (/penthouse/.test(s)) return 'penthouse';
  if (/cobertura/.test(s)) return /duplex/.test(s) ? 'cobertura_duplex' : 'cobertura';
  if (/garden/.test(s)) return 'apartamento_garden';
  if (/triplex/.test(s)) return 'apartamento_triplex';
  if (/duplex/.test(s)) return 'apartamento_duplex';
  if (/\bstudio\b|\bstudios\b/.test(s)) return 'studio';
  if (/\bloft\b/.test(s)) return 'loft';
  if (/\bflat\b/.test(s)) return 'flat';
  if (/\bsobrado/.test(s)) return 'sobrado';
  if (/\blote\b|\blotes\b|terreno/.test(s) && !/\bapart/.test(s)) return undefined;
  if (/\bsala\b|\bsalas\b|comercial/.test(s)) return 'sala_comercial';
  if (/\bloja/.test(s)) return 'loja_ponto_comercial';
  if (/\bcasa/.test(s)) return 'casa_condominio';
  return undefined;
}

const PRIORIDADE: TipoUnidade[] = ['penthouse', 'cobertura_duplex', 'cobertura', 'apartamento_garden', 'apartamento_triplex', 'apartamento_duplex'];

type Pista = { area: number; tipo?: TipoUnidade; quartos?: number; vagas?: number; unidades?: number; rotulo?: string; doc: string };

function pistasDeArea(docs: { doc: PdfDoc; tipo: TipoDoc }[]): Pista[] {
  const pistas: Pista[] = [];
  for (const { doc, tipo } of docs) {
    if (tipo === 'tabela') continue;
    for (const pag of doc.paginas) {
      const textoPag = pag.join(' \n ');
      const areasPag = pag.flatMap(todasAreas).filter((a) => a >= 20 && a < 2000);
      const inteiros = new Set(areasPag.map((a) => Math.floor(a)));
      // Página de planta: uma só área (ex.: "130m²") + "03 suítes" / "3 quartos"
      if (inteiros.size === 1 && areasPag.length) {
        const q = textoPag.match(/(\d{1,2})\s*(?:su[ií]tes?|quartos?|dormit[oó]rios?|dorms?\.?)\b/i);
        pistas.push({ area: areasPag[0], tipo: tipoPorTexto(textoPag), quartos: q ? Number(q[1]) : undefined, doc: doc.nome });
      }
      // Linhas com área: "4 Unidades Garden: 148,78 m² com 3 vagas", "• 62 unidades de 130,68 m² com varanda gourmet"
      pag.forEach((l, i) => {
        const areas = todasAreas(l).filter((a) => a >= 20 && a < 2000);
        if (!areas.length || RE_LINHA_UNIDADE.test(l)) return;
        const ctx = `${l} ${pag[i + 1] && !todasAreas(pag[i + 1]).length ? pag[i + 1] : ''}`;
        const un = l.match(/(\d{1,4})\s+unidades?/i);
        const vg = ctx.match(/(\d)\s+vagas?/i);
        const q = l.match(/(\d{1,2})\s*(?:su[ií]tes?|quartos?|dormit[oó]rios?)\b/i);
        const rot = ctx.match(/com\s+(varanda [a-zà-ú]+|balc[aã]o|piscina privativa)/i);
        // Em linhas "252,86 m² duplex (118,03 m² superior e 134,83 m² inferior)" só vale a 1ª área
        pistas.push({
          area: areas[0],
          tipo: tipoPorTexto(ctx),
          quartos: q ? Number(q[1]) : undefined,
          vagas: vg ? Number(vg[1]) : undefined,
          unidades: un ? Number(un[1]) : undefined,
          rotulo: rot?.[1]?.toLowerCase(),
          doc: doc.nome
        });
      });
    }
  }
  return pistas;
}

const perto = (a: number, b: number, tol = 0.012) => Math.abs(a - b) / Math.max(a, b) <= tol || Math.floor(a) === Math.floor(b);

// ---------- lazer ----------

const AMENIDADE_REGRAS: [string, RegExp][] = [
  ['Piscina', /piscina|raia/],
  ['Academia', /academia|fitness|crossfit/],
  ['Salão de festas', /sal[aã]o de festas|\bfestas\b/],
  ['Playground', /playground|village kids|parquinho/],
  ['Portaria 24h', /portaria 24|portaria\s+24h/],
  ['Segurança 24h', /seguran[cç]a 24|monitoramento 24|reconhecimento facial|c[aâ]meras? com ia/],
  ['Bicicletário', /biciclet[aá]rio/],
  ['Quadra poliesportiva', /quadra (poli|esportiva)|poliesportiva/],
  ['Espaço pet', /\bpet\b|pet place|pet park/],
  ['Espaço gourmet', /gourmet/],
  ['Churrasqueira', /churrasqueira/],
  ['Coworking', /coworking|co-working/],
  ['Rooftop', /rooftop|roof top/],
  ['Sauna', /sauna/],
  ['Salão de jogos', /sal[aã]o de jogos|sinuca|carteado|jogos/],
  ['Área verde', /bosque|paisagismo|jardins?\b|[aá]rea verde/],
  ['Elevador', /elevador/],
  ['Vaga coberta', /subsolo|garagem coberta|vagas? cobertas?|mezanino de garagem|mezaninos de garagem/]
];

const LAZER_IGNORAR = /^(banheiro|sanit[aá]rio.*|elevador.*|caixa de escada|[aá]rea t[eé]cnica|dml|copa.*|circula[cç][aã]o|acesso.*|lixo|central de g[aá]s|guarita.*|hall.*|escada.*|embarque.*|shaft|dep[oó]sito.*|storage.*|espa[cç]o para guarda.*)$/i;

function destaquesDoLazer(docs: PdfDoc[]): string[] {
  const out: string[] = [];
  for (const d of docs)
    for (const pag of d.paginas) {
      const texto = semAcento(pag.join(' ').toLowerCase());
      if (!/\blazer\b/.test(texto)) continue;
      const itens = pag.flatMap((l) => Array.from(l.matchAll(/\b\d{2}\.\s+([^\d][^]*?)(?=\s{3,}|\s+\d{2}\.\s|$)/g)).map((m) => m[1].trim()));
      if (itens.length < 5) continue;
      for (const it of itens) {
        const k = it.toLowerCase();
        if (LAZER_IGNORAR.test(it) || it.length <= 2 || out.some((o) => o.toLowerCase().startsWith(k))) continue;
        const i = out.findIndex((o) => k.startsWith(o.toLowerCase()));
        if (i >= 0) out[i] = it; // versão mais completa do mesmo item
        else out.push(it);
      }
    }
  return out.slice(0, 30);
}

// ---------- montagem final ----------

export function analisarDocs(docs: PdfDoc[]): ImportResult {
  const avisos: string[] = [];
  const encontrados: ImportResult['encontrados'] = [];
  const achou = (campo: string, valor: string, doc: string) => encontrados.push({ campo, valor, doc });

  const classificados = docs.map((doc) => ({ doc, tipo: classificarDoc(doc) }));
  const docsInfo = classificados.map(({ doc, tipo }) => ({
    nome: doc.nome,
    tipo,
    paginas: doc.paginas.length,
    semTexto: doc.paginas.flat().join('').replace(/\s/g, '').length < 30
  }));
  for (const d of docsInfo)
    if (d.semTexto) avisos.push(`"${d.nome}" não tem texto selecionável (parece imagem/escaneado) — sem OCR não dá para ler este arquivo.`);

  // Linhas "de ficha" (ficha técnica primeiro, depois os outros)
  const ordem: TipoDoc[] = ['ficha', 'tabela', 'plantas', 'book', 'outro'];
  const ordenados = [...classificados].sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo));
  const campo = (re: RegExp) => {
    for (const { doc } of ordenados) {
      const r = acharCampo(doc.paginas.flat(), re);
      if (r && r.valor) return { ...r, doc: doc.nome, linhas: doc.paginas.flat() };
    }
    return undefined;
  };

  // Nome
  const nome = formatTitulo(acharNome(ordenados.map((c) => c.doc)) ?? '');
  if (nome) achou('Nome', nome, 'repetição nos documentos / título da tabela');
  else avisos.push('Não encontrei o nome do empreendimento — preencha na conferência.');

  // Construtora
  const cons = campo(/construtora(?:\s*\/\s*incorporadora)?|incorporadora(?:\s*\/\s*construtora)?|realiza[cç][aã]o|incorpora[cç][aã]o/);
  const construtora = cons?.valor;
  if (cons) achou('Construtora', cons.valor, cons.doc);

  // Endereço (pode continuar na linha de baixo)
  let endereco = { logradouro: '', bairro: '', cidade: '', uf: '', cep: '' };
  const end = campo(/endere[cç]o|localiza[cç][aã]o/);
  if (end) {
    let bruto = end.valor;
    const prox = end.linhas[end.idx + 1]?.trim() ?? '';
    if (!/[A-Z]{2}\s*$/.test(bruto) && prox && !prox.includes(':') && prox.length < 60) bruto += ', ' + prox;
    endereco = parseEndereco(bruto);
    achou('Endereço', bruto, end.doc);
  } else avisos.push('Endereço não encontrado — informe o CEP na conferência.');

  // Entrega
  let entrega: string | undefined;
  const ent = campo(/prazo de entrega|previs[aã]o de entrega|data de entrega|entrega(?: prevista)?|conclus[aã]o(?: da obra)?|t[eé]rmino da obra/);
  if (ent) {
    entrega = parseMesAno(ent.valor);
    if (entrega) achou('Entrega', `${ent.valor} → ${mesAnoExtenso(entrega)}`, ent.doc);
  }
  if (!entrega) {
    for (const { doc } of ordenados) {
      const ls = doc.paginas.flat();
      const i = ls.findIndex((l) => /entrega das chaves|habite-?se|previs[aã]o de entrega/i.test(l));
      if (i >= 0) {
        const trecho = ls.slice(i, i + 4).join(' ');
        const datas = Array.from(trecho.matchAll(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g)).map((m) => m[0]);
        const cand = parseMesAno(datas.at(-1) ?? trecho);
        if (cand) {
          entrega = cand;
          achou('Entrega', `${datas.at(-1) ?? ''} (entrega das chaves) → ${mesAnoExtenso(cand)}`, doc.nome);
          break;
        }
      }
    }
  }
  if (!entrega) avisos.push('Data de entrega não encontrada — é obrigatória para publicar.');

  // Pavimentos, torres, terreno, total de unidades
  const pav = campo(/n[uú]mero de pavimentos|pavimentos|andares/);
  const pavimentos = pav ? Number(pav.valor.match(/\d+/)?.[0]) || undefined : undefined;
  if (pavimentos) achou('Pavimentos', String(pavimentos), pav!.doc);
  const tor = campo(/n[uú]mero de torres|torres?|blocos?/);
  const torres = tor?.valor.split('(')[0].trim() || undefined;
  const ter = campo(/[aá]rea (?:total )?do terreno|terreno/);
  const areaTerreno = ter ? (parseArea(ter.valor) ? areaTxt(parseArea(ter.valor)!) : undefined) : undefined;
  if (areaTerreno) achou('Área do terreno', areaTerreno, ter!.doc);
  const tot = campo(/total de unidades|n[uú]mero de unidades|unidades/);
  const totalUnidades = tot ? Number(tot.valor.match(/\d+/)?.[0]) || undefined : undefined;

  // Ficha técnica "pública" (créditos de projeto) — fatos curtos, sem copiar texto de marketing
  const fichaTecnica: ImportResult['fichaTecnica'] = [];
  if (construtora) fichaTecnica.push({ rotulo: 'Construtora', valor: construtora });
  for (const [rot, re] of [
    ['Arquitetura', /arquitetura/],
    ['Paisagismo', /paisagismo(?: e interiores)?/],
    ['Interiores', /interiores|decora[cç][aã]o/],
    ['Área construída', /[aá]rea constru[ií]da/],
    ['Elevadores', /elevadores/]
  ] as [string, RegExp][]) {
    const r = campo(re);
    if (r && r.valor.length <= 80) fichaTecnica.push({ rotulo: rot, valor: r.valor.replace(/\s+/g, ' ') });
  }

  // Tipologias
  const pistas = pistasDeArea(classificados);
  const unidades = classificados.filter((c) => c.tipo === 'tabela').flatMap((c) => lerTabela(c.doc));
  if (unidades.length) achou('Tabela de vendas', `${unidades.length} unidades lidas (${unidades.filter((u) => u.situacao === 'disponivel').length} disponíveis)`, classificados.find((c) => c.tipo === 'tabela')!.doc.nome);

  const grupos: { areas: number[]; itens: UnidadeTabela[] }[] = [];
  for (const u of unidades) {
    const g = grupos.find((gr) => gr.areas.some((a) => Math.abs(a - u.area) / Math.max(a, u.area) <= 0.01));
    if (g) {
      g.areas.push(u.area);
      g.itens.push(u);
    } else grupos.push({ areas: [u.area], itens: [u] });
  }
  // Sem tabela: tipologias vêm da ficha/caderno ("62 unidades de 130,68 m²", "Tipo 1: 118,38 m²")
  if (!grupos.length) {
    for (const p of pistas) {
      if (p.area < 25) continue;
      if (!grupos.some((g) => perto(g.areas[0], p.area, 0.01))) grupos.push({ areas: [p.area], itens: [] });
    }
    // descarta áreas que são "parte" de outra (superior/inferior do duplex)
    if (grupos.length) avisos.push('Sem tabela de vendas: tipologias montadas pelas áreas da ficha/plantas, sem preço.');
  }

  const moda = <T,>(xs: T[]): T | undefined => {
    const c = new Map<T, number>();
    xs.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  // Vagas padrão por tipo vindas da ficha ("Unidades de Tipo com 2 vagas, Garden com 3 vagas e Duplex com 4 vagas")
  const textoFicha = semAcento(classificados.filter((c) => c.tipo !== 'tabela').map((c) => c.doc.paginas.flat().join(' ')).join(' ').toLowerCase());
  const vagasPorTipo: Record<string, number> = {};
  for (const m of Array.from(textoFicha.matchAll(/(tipo|garden|duplex|cobertura|penthouse)s?\s+com\s+(\d)\s+vagas?/g))) vagasPorTipo[m[1]] = Number(m[2]);

  let tipologias: TipologiaImport[] = grupos.map((g) => {
    const area = moda(g.areas) ?? g.areas[0];
    const ps = pistas.filter((p) => perto(p.area, area));
    const tiposPistas = ps.map((p) => p.tipo).filter(Boolean) as TipoUnidade[];
    const tipoUnidade = PRIORIDADE.find((t) => tiposPistas.includes(t)) ?? moda(tiposPistas) ?? 'apartamento';
    const disp = g.itens.filter((u) => u.situacao === 'disponivel' || u.situacao === 'outra');
    const precos = (disp.length ? disp : g.itens).map((u) => u.valor).filter((v): v is number => !!v);
    const vagasTabela = moda(g.itens.map((u) => u.vagas).filter((v): v is number => !!v));
    const chave = tipoUnidade === 'apartamento_garden' ? 'garden' : /duplex|penthouse/.test(tipoUnidade) ? 'duplex' : /cobertura/.test(tipoUnidade) ? 'cobertura' : 'tipo';
    const vagas = vagasTabela ?? ps.find((p) => p.vagas)?.vagas ?? vagasPorTipo[chave] ?? (chave === 'duplex' ? vagasPorTipo.penthouse : undefined);
    const quartos = moda(ps.map((p) => p.quartos).filter((q): q is number => !!q && q <= 10));
    return {
      tipoUnidade,
      area: Math.round(area * 100) / 100,
      quartos,
      vagas,
      precoMin: precos.length ? Math.min(...precos) : undefined,
      precoMax: precos.length ? Math.max(...precos) : undefined,
      disponiveis: g.itens.filter((u) => u.situacao === 'disponivel').length,
      total: g.itens.length,
      unidades: g.itens.map((u) => u.unidade),
      rotulo: ps.find((p) => p.rotulo)?.rotulo
    };
  });
  // Sem tabela: remove áreas que são partes de um duplex (superior/inferior) já listado
  if (!unidades.length) {
    tipologias = tipologias.filter((t, _, all) => !all.some((o) => o !== t && /duplex|penthouse|cobertura_duplex/.test(o.tipoUnidade) && t.area < o.area * 0.7 && all.some((x) => x !== o && x !== t && Math.abs(x.area + t.area - o.area) < 3)));
  }
  tipologias.sort((a, b) => a.area - b.area);
  if (tipologias.some((t) => !t.quartos)) avisos.push('Algumas tipologias estão sem nº de quartos/suítes — confira nas plantas.');

  // Lazer
  const textoTudo = semAcento(docs.map((d) => d.paginas.flat().join(' ')).join(' ').toLowerCase());
  const amenities = AMENIDADES_PADRAO.filter((a) => {
    const r = AMENIDADE_REGRAS.find(([n]) => n === a)?.[1];
    return r ? r.test(textoTudo) : false;
  });
  const destaquesLazer = destaquesDoLazer(docs);

  const tipo: 'vertical' | 'horizontal' =
    tipologias.length && tipologias.every((t) => /casa|sobrado|terreno|chacara/.test(t.tipoUnidade)) ? 'horizontal' : pavimentos || /torre|apartamento/.test(textoTudo) ? 'vertical' : 'horizontal';

  const r: ImportResult = {
    nome,
    construtora,
    endereco,
    entrega,
    pavimentos,
    torres,
    totalUnidades,
    areaTerreno,
    tipo,
    amenities,
    destaquesLazer,
    fichaTecnica,
    tipologias,
    descricao: '',
    docs: docsInfo,
    encontrados,
    avisos
  };
  r.descricao = gerarDescricao(r);
  return r;
}

// ---------- descrição (modelo de SEO, só com fatos extraídos) ----------

export function gerarDescricao(r: ImportResult): string {
  const nome = r.nome || 'O empreendimento';
  const bairro = r.endereco.bairro;
  const cidade = r.endereco.cidade;
  const onde = [bairro, cidade].filter(Boolean).join(', ');
  const tiposNomes = Array.from(new Set(r.tipologias.map((t) => TIPO_UNIDADE_LABEL[t.tipoUnidade]))).map((t, i) => (i === 0 ? t : t.toLowerCase()));
  const tiposTxt = tiposNomes.length > 1 ? `${tiposNomes.slice(0, -1).join(', ')} e ${tiposNomes.at(-1)}` : tiposNomes[0] ?? 'Apartamentos';
  const areas = r.tipologias.map((t) => t.area);
  const quartos = Array.from(new Set(r.tipologias.map((t) => t.quartos).filter(Boolean) as number[])).sort((a, b) => a - b);
  const precos = r.tipologias.map((t) => t.precoMin).filter(Boolean) as number[];

  const l: string[] = [];
  l.push(`## ${nome}${onde ? ` no ${bairro || cidade}` : ''}: ${tiposTxt.toLowerCase().replace(/^./, (c) => c.toUpperCase())}${quartos.length ? ` de ${quartos.join(' e ')} ${quartos.length === 1 && quartos[0] === 1 ? 'quarto' : 'suítes'}` : ''}`);
  const frase: string[] = [];
  frase.push(`O **${nome}** é um lançamento${r.construtora ? ` da **${r.construtora}**` : ''}${onde ? ` no **${bairro || cidade}**${bairro && cidade ? `, em ${cidade}` : ''}` : ''}`);
  if (areas.length) frase.push(`com plantas de **${areaTxt(Math.min(...areas))}${areas.length > 1 ? ` a ${areaTxt(Math.max(...areas))}` : ''}**`);
  l.push(frase.join(', ') + '.');
  const estrutura: string[] = [];
  if (r.totalUnidades) estrutura.push(`${r.totalUnidades} unidades`);
  if (r.torres) estrutura.push(/única|unica/i.test(r.torres) ? 'torre única' : r.torres.toLowerCase());
  if (r.pavimentos) estrutura.push(`${r.pavimentos} pavimentos`);
  if (estrutura.length || r.entrega)
    l.push(`${estrutura.length ? `São ${estrutura.join(', ')}` : 'Obra'}${r.entrega ? `, com previsão de entrega em **${mesAnoExtenso(r.entrega)}**` : ''}.${precos.length ? ` Unidades a partir de **${brlCurto(Math.min(...precos))}**.` : ''}`);

  if (r.tipologias.length) {
    l.push('', '## Plantas e tipologias');
    for (const t of r.tipologias) {
      const partes = [t.quartos ? `${t.quartos} ${t.quartos === 1 ? 'suíte' : 'suítes'}` : null, t.vagas ? `${t.vagas} vagas` : null, t.rotulo ?? null].filter(Boolean);
      l.push(`- **${TIPO_UNIDADE_LABEL[t.tipoUnidade]} de ${areaTxt(t.area)}**${partes.length ? ` — ${partes.join(', ')}` : ''}${t.precoMin ? ` — a partir de ${brlCurto(t.precoMin)}` : ''}`);
    }
  }
  if (r.destaquesLazer.length || r.amenities.length) {
    l.push('', '## Lazer e estrutura');
    const itens = r.destaquesLazer.length ? r.destaquesLazer.slice(0, 14) : r.amenities;
    for (const it of itens) l.push(`- ${it}`);
  }
  const ficha = [...r.fichaTecnica];
  if (r.endereco.logradouro || onde) ficha.push({ rotulo: 'Endereço', valor: [r.endereco.logradouro, bairro, [cidade, r.endereco.uf].filter(Boolean).join('/')].filter(Boolean).join(', ') });
  if (r.areaTerreno) ficha.push({ rotulo: 'Área do terreno', valor: r.areaTerreno });
  if (r.entrega) ficha.push({ rotulo: 'Previsão de entrega', valor: mesAnoExtenso(r.entrega) });
  if (ficha.length) {
    l.push('', '## Ficha técnica');
    for (const f of ficha) l.push(`- ${f.rotulo}: ${f.valor}`);
  }
  if (onde) l.push('', `Procurando ${tiposNomes[0]?.toLowerCase() ?? 'apartamento'} na planta no ${bairro || cidade}? Registre seu interesse e receba a tabela atualizada do ${nome}.`);
  return l.join('\n');
}

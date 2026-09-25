// Cadastro de condomínios em lote a partir de planilha (.xlsx ou .csv).
// Reconhece as colunas pelo nome do cabeçalho (qualquer ordem), padroniza
// maiúsculas/acentos e prepara as linhas para conferência antes de salvar.
import { formatTitulo } from './text';
import { AMENIDADES_PADRAO } from './amenidades';
import { AMENIDADE_REGRAS } from './pdf-import/parse';
import type { TipoUnidade } from './tipologias';

export type CampoPlanilha =
  | 'nome'
  | 'tipo'
  | 'cep'
  | 'uf'
  | 'cidade'
  | 'bairro'
  | 'logradouro'
  | 'entrega'
  | 'descricao'
  | 'pavimentos'
  | 'lazer'
  | 'construtora'
  | 'tipos'
  | 'numero'
  | 'quadra'
  | 'lote'
  | 'excluido'
  | 'publicado'
  | 'lat'
  | 'lng'
  | 'video';

export const CAMPOS: { campo: CampoPlanilha; rotulo: string; obrigatorio?: boolean; re: RegExp }[] = [
  { campo: 'nome', rotulo: 'Nome do condomínio', obrigatorio: true, re: /^(nome|condom|empreend|edif|residencial)/ },
  { campo: 'tipo', rotulo: 'Tipo (vertical/horizontal)', re: /^tipo ?(de )?(condom|empreend)|^tipo$|vertical|horizontal/ },
  { campo: 'tipos', rotulo: 'Tipos de imóvel / uso', re: /tipos? de imov|tipologia|tipo de unidade|^tipo ?(de )?uso/ },
  { campo: 'cep', rotulo: 'CEP', re: /^cep/ },
  { campo: 'uf', rotulo: 'UF', re: /^(uf|estado)$/ },
  { campo: 'cidade', rotulo: 'Cidade', obrigatorio: true, re: /^(cidade|municipio)/ },
  { campo: 'bairro', rotulo: 'Bairro', obrigatorio: true, re: /^(bairro|setor)/ },
  { campo: 'logradouro', rotulo: 'Logradouro', re: /logr|lugr|^rua|endere/ },
  { campo: 'entrega', rotulo: 'Entrega (ano ou data)', obrigatorio: true, re: /entrega|^ano|conclus|habite|^data (de )?constru/ },
  { campo: 'descricao', rotulo: 'Descrição', re: /descri|narrativa|texto|^informac/ },
  { campo: 'numero', rotulo: 'Número', re: /^numero$|^n[o.]?$|^num$/ },
  { campo: 'quadra', rotulo: 'Quadra', re: /^(quadra|qd)/ },
  { campo: 'lote', rotulo: 'Lote', re: /^(lote|lt)$/ },
  { campo: 'excluido', rotulo: 'Excluído (1 = ignorar)', re: /isdeleted|^excluid|^deletad|^removid/ },
  { campo: 'publicado', rotulo: 'Publicado (0 = rascunho)', re: /^publicad|^ativo$|^status/ },
  { campo: 'lat', rotulo: 'Latitude', re: /^lat/ },
  { campo: 'lng', rotulo: 'Longitude', re: /^(lon|lng)/ },
  { campo: 'video', rotulo: 'Vídeo (YouTube)', re: /youtube|^video/ },
  { campo: 'pavimentos', rotulo: 'Pavimentos', re: /pavim|andares/ },
  { campo: 'lazer', rotulo: 'Lazer / comodidades', re: /lazer|comodid|amenid|diferenc/ },
  { campo: 'construtora', rotulo: 'Construtora', re: /construt|incorpor/ }
];

const sa = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const chaveNome = (s: string) => sa(s).replace(/^(condominio|edificio|ed\.?|residencial)\s+/, '').replace(/[^a-z0-9]/g, '');

export function mapearCabecalho(cabecalho: string[]): Partial<Record<CampoPlanilha, number>> {
  const out: Partial<Record<CampoPlanilha, number>> = {};
  cabecalho.forEach((h, i) => {
    const n = sa(String(h ?? ''));
    if (!n) return;
    for (const c of CAMPOS) {
      if (out[c.campo] == null && c.re.test(n)) {
        out[c.campo] = i;
        break;
      }
    }
  });
  return out;
}

// Acentos que as planilhas costumam perder (nomes, bairros e cidades de Goiás)
const ACENTOS: Record<string, string> = {
  edificio: 'Edifício', condominio: 'Condomínio', goiania: 'Goiânia', goias: 'Goiás', anapolis: 'Anápolis', brasilia: 'Brasília',
  sao: 'São', joao: 'João', jose: 'José', antonio: 'Antônio', conceicao: 'Conceição', universitario: 'Universitário', universitaria: 'Universitária',
  nacoes: 'Nações', suica: 'Suíça', marilia: 'Marília', crimeia: 'Criméia', magalhaes: 'Magalhães', negrao: 'Negrão', agua: 'Água',
  mansao: 'Mansão', espaco: 'Espaço', paraiso: 'Paraíso', palacio: 'Palácio', cristovao: 'Cristóvão', monica: 'Mônica', lucia: 'Lúcia',
  vitoria: 'Vitória', gloria: 'Glória', fatima: 'Fátima', sebastiao: 'Sebastião', estevao: 'Estêvão', helio: 'Hélio', jao: 'Jaó',
  america: 'América', europa: 'Europa', italia: 'Itália', franca: 'França', genova: 'Gênova', veneza: 'Veneza', atlantico: 'Atlântico',
  pacifico: 'Pacífico', mediterraneo: 'Mediterrâneo', ipe: 'Ipê', ipes: 'Ipês', jatoba: 'Jatobá', araguaia: 'Araguaia', tocantins: 'Tocantins',
  oasis: 'Oásis', imperio: 'Império', principe: 'Príncipe', princesa: 'Princesa', flamboyant: 'Flamboyant', petropolis: 'Petrópolis',
  florianopolis: 'Florianópolis', uruguai: 'Uruguai', panama: 'Panamá', canada: 'Canadá', mexico: 'México', japao: 'Japão', grecia: 'Grécia',
  ingles: 'Inglês', frances: 'Francês', residencia: 'Residência', praca: 'Praça', ceu: 'Céu', ilhas: 'Ilhas', ilha: 'Ilha', sol: 'Sol',
  vale: 'Vale', jardins: 'Jardins', parque: 'Parque', bela: 'Bela', solar: 'Solar', unica: 'Única', historico: 'Histórico',
  aurea: 'Áurea', angelica: 'Angélica', leticia: 'Letícia', patricia: 'Patrícia', cecilia: 'Cecília', julia: 'Júlia', mario: 'Mário',
  cassio: 'Cássio', flavio: 'Flávio', claudio: 'Cláudio', marcio: 'Márcio', sergio: 'Sérgio', vinicius: 'Vinícius', tiete: 'Tietê',
  chacaras: 'Chácaras', chacara: 'Chácara', jaragua: 'Jaraguá', efigenia: 'Efigênia', abrao: 'Abrão', froes: 'Fróes', genoveva: 'Genoveva',
  itaperuna: 'Itaperuna', eldorado: 'Eldorado', coimbra: 'Coimbra', aeroporto: 'Aeroporto', pedro: 'Pedro', ludovico: 'Ludovico'
};

const ABREV: [RegExp, string][] = [
  [/^(jd|jard)\.?\s/i, 'Jardim '],
  [/^(st|s|set)\.?\s/i, 'Setor '],
  [/^(vl|v)\.?\s/i, 'Vila '],
  [/^(res|resid)\.?\s/i, 'Residencial '],
  [/^(pq|prq)\.?\s/i, 'Parque '],
  [/^(cj|conj)\.?\s/i, 'Conjunto '],
  [/^(ch|chac)\.?\s/i, 'Chácaras '],
  [/\bcel\.?\s/i, 'Coronel '],
  [/\bsud\.?\s/i, 'Sudoeste '],
  [/\bdr\.?\s/i, 'Doutor ']
];
/** "ST P LUDOVICO" → "Setor P Ludovico"; "JD GOIAS" → "Jardim Goiás" */
export function padronizarBairro(s: string): string {
  let t = String(s ?? '').trim().replace(/\s+/g, ' ');
  for (const [re, por] of ABREV) t = t.replace(re, por);
  return padronizarNome(t);
}

const tokens = (s: string) => sa(s).split(/[^a-z0-9]+/).filter((t) => t && !['setor', 'st', 'jardim', 'jd', 'vila', 'vl', 'residencial', 'parque', 'rua', 'r', 'avenida', 'av', 'alameda', 'al', 'de', 'da', 'do', 'das', 'dos'].includes(t));
/** O valor oficial (do CEP) "cobre" o da planilha? ("St P Ludovico" ⊂ "Setor Pedro Ludovico"; "T 47" ⊂ "Rua T-47") */
export function combina(planilha: string, oficial: string): boolean {
  const a = tokens(planilha);
  const b = tokens(oficial);
  if (!a.length || !b.length) return false;
  return a.every((t) => b.some((u) => u === t || (t.length <= 2 && u.startsWith(t)) || (t.length >= 4 && u.startsWith(t))));
}

/** "EDIFICIO SAO JOAO" → "Edifício São João" (siglas e números preservados) */
export function padronizarNome(s: string): string {
  const base = formatTitulo(String(s ?? '').trim());
  return base
    .split(' ')
    .map((w) => {
      const k = sa(w);
      const ac = ACENTOS[k];
      if (!ac) return w;
      return w === w.toLowerCase() ? ac.toLowerCase() : ac;
    })
    .join(' ');
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Date do Excel, número serial, "2019", "08/2019", "28/08/1999", "ago/2019" → "AAAA-MM" */
export function lerEntrega(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}`;
  if (typeof v === 'number') {
    if (v >= 1900 && v <= 2100) return `${v}-01`;
    if (v > 20000 && v < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    return undefined;
  }
  const t = sa(String(v));
  let m = t.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}`;
  m = t.match(/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = t.match(/([a-z]{3})[a-z]*\.?\s*(?:\/|de|-)?\s*(\d{4})/);
  if (m && MESES.includes(m[1])) return `${m[2]}-${String(MESES.indexOf(m[1]) + 1).padStart(2, '0')}`;
  m = t.match(/\b(19\d{2}|20\d{2})\b/);
  if (m) return `${m[1]}-01`;
  return undefined;
}

export type CondoPlanilha = {
  linha: number;
  nome: string;
  tipo: 'vertical' | 'horizontal';
  tiposUnidade: TipoUnidade[];
  cep: string;
  uf: string;
  cidade: string;
  bairro: string;
  logradouro: string;
  entrega?: string;
  descricao: string;
  pavimentos?: number;
  amenities: string[];
  construtora?: string;
  problemas: string[];
  duplicadaNaPlanilha?: boolean;
  rascunho?: boolean; // planilha marcou como não publicado
  lat?: number;
  lng?: number;
  videoUrl?: string;
  cepGenerico?: boolean;
  fonte?: string; // nome do arquivo
};

// ---------- Mesmo condomínio? (para não duplicar) ----------
// Mesmo nome E (mesmo CEP — se o CEP não for genérico — OU mesmo bairro na mesma cidade).
// Nomes repetidos em bairros diferentes são condomínios diferentes (muito comum).
export const chaveBairro = (b: string) =>
  sa(padronizarBairro(b ?? ''))
    .replace(/^(setor|jardim|vila|residencial|parque|conjunto|chacaras)\s+/, '')
    .replace(/[^a-z0-9]/g, '');

export function mesmoCondominio(
  a: { nome: string; cep?: string | null; bairro?: string | null; cidade?: string | null },
  b: { nome: string; cep?: string | null; bairro?: string | null; cidade?: string | null },
  cepsGenericos: Set<string> = new Set()
): boolean {
  if (chaveNome(a.nome) !== chaveNome(b.nome)) return false;
  const ca = (a.cep ?? '').replace(/\D/g, '');
  const cb = (b.cep ?? '').replace(/\D/g, '');
  if (ca && ca === cb && !cepsGenericos.has(ca)) return true;
  const mesmaCidade = !a.cidade || !b.cidade || sa(a.cidade) === sa(b.cidade);
  return mesmaCidade && !!a.bairro && !!b.bairro && chaveBairro(a.bairro) === chaveBairro(b.bairro);
}

/** CEP que aparece em 3+ bairros diferentes = CEP "genérico" (ex.: CEP geral da cidade) — não serve para localizar.
 *  Vários prédios na mesma rua com o mesmo CEP é normal e continua valendo. */
export function acharCepsGenericos(lista: { cep: string; bairro: string }[], limiteBairros = 3): Set<string> {
  const porCep = new Map<string, Set<string>>();
  for (const c of lista) {
    if (!c.cep) continue;
    const s0 = porCep.get(c.cep) ?? new Set<string>();
    s0.add(chaveBairro(c.bairro));
    porCep.set(c.cep, s0);
  }
  return new Set(Array.from(porCep.entries()).filter(([, b]) => b.size >= limiteBairros).map(([cep]) => cep));
}

/** Junta planilhas: o mesmo condomínio vira 1 só, somando o que cada arquivo tem de melhor */
export function mesclarCondominios(todas: CondoPlanilha[]): { lista: CondoPlanilha[]; mesclados: number } {
  const genericos = acharCepsGenericos(todas);
  const out: CondoPlanilha[] = [];
  let mesclados = 0;
  // índice por nome para não comparar todos com todos
  const porNome = new Map<string, CondoPlanilha[]>();
  for (const c0 of todas) {
    const c = { ...c0, cepGenerico: !!c0.cep && genericos.has(c0.cep) };
    if (c.cepGenerico) c.problemas = [...c.problemas.filter((p) => p !== 'sem CEP'), 'CEP genérico (repetido em vários condomínios), não usado'];
    const k = chaveNome(c.nome);
    const iguais = porNome.get(k) ?? [];
    const alvo = iguais.find((o) => mesmoCondominio(o, c, genericos));
    if (!alvo) {
      out.push(c);
      porNome.set(k, [...iguais, c]);
      continue;
    }
    mesclados++;
    // completa o que falta; descrição: fica a mais completa
    if ((!alvo.cep || alvo.cepGenerico) && c.cep && !c.cepGenerico) {
      alvo.cep = c.cep;
      alvo.cepGenerico = false;
    }
    if (!alvo.logradouro || (c.logradouro && c.logradouro.length > alvo.logradouro.length)) alvo.logradouro = c.logradouro || alvo.logradouro;
    if (!alvo.entrega) alvo.entrega = c.entrega;
    if (c.descricao && c.descricao.length > (alvo.descricao?.length ?? 0)) alvo.descricao = c.descricao;
    if (!alvo.pavimentos) alvo.pavimentos = c.pavimentos;
    if (!alvo.lat && c.lat) {
      alvo.lat = c.lat;
      alvo.lng = c.lng;
    }
    if (!alvo.videoUrl) alvo.videoUrl = c.videoUrl;
    alvo.amenities = Array.from(new Set([...alvo.amenities, ...c.amenities]));
    alvo.tiposUnidade = Array.from(new Set([...alvo.tiposUnidade, ...c.tiposUnidade]));
    if (alvo.rascunho && !c.rascunho) alvo.rascunho = false;
    if (alvo.nome === alvo.nome.toUpperCase() && c.nome !== c.nome.toUpperCase()) alvo.nome = c.nome;
    alvo.fonte = Array.from(new Set([alvo.fonte, c.fonte].filter(Boolean))).join(' + ');
    alvo.problemas = [
      ...(!alvo.entrega ? ['sem data de entrega (entra como rascunho)'] : []),
      ...(!alvo.cep ? ['sem CEP'] : alvo.cepGenerico ? ['CEP genérico (repetido em vários condomínios), não usado'] : [])
    ];
  }
  for (const c of out) if (c.cepGenerico) c.cep = '';
  return { lista: out, mesclados };
}

// Troca na descrição os nomes em CAIXA ALTA pelos padronizados
function ajustarDescricao(desc: string, trocas: [string, string][]): string {
  let d = desc;
  for (const [de, para] of trocas) if (de && para && de !== para) d = d.split(de).join(para);
  return d.replace(/\s+/g, ' ').trim();
}

export function linhasParaCondominios(linhas: unknown[][], mapa: Partial<Record<CampoPlanilha, number>>, primeiraLinhaDados = 2): CondoPlanilha[] {
  const get = (row: unknown[], c: CampoPlanilha) => (mapa[c] != null ? row[mapa[c]!] : undefined);
  const txt = (v: unknown) => (v == null ? '' : v instanceof Date ? v.toISOString() : String(v)).trim();
  const vistos = new Set<string>();
  const out: CondoPlanilha[] = [];
  linhas.forEach((row, i) => {
    const nomeBruto = txt(get(row, 'nome'));
    if (!nomeBruto) return;
    // linhas marcadas como excluídas e cadastros de teste ficam de fora
    const excl = sa(txt(get(row, 'excluido')));
    if (excl === '1' || excl === 'sim' || excl === 'true' || /^teste\b/.test(sa(nomeBruto))) return;
    const tipoTxt = sa(txt(get(row, 'tipo')));
    // códigos de sistemas (ex.: 1 = vertical, 3/4 = horizontal) ou texto
    const tipo: 'vertical' | 'horizontal' = /horiz|casa|lote|sobrado|^3$|^4$/.test(tipoTxt) ? 'horizontal' : 'vertical';
    const bairroBruto = txt(get(row, 'bairro'));
    const cidadeBruta = txt(get(row, 'cidade'));
    const nome = padronizarNome(nomeBruto.replace(/^res\.?\s/i, 'Residencial ').replace(/^ed\.?\s/i, 'Edifício ').replace(/^cond\.?\s/i, 'Condomínio '));
    const bairro = padronizarBairro(bairroBruto);
    const cidade = padronizarNome(cidadeBruta);
    const cepDig = txt(get(row, 'cep')).replace(/\D/g, '');
    const cep = cepDig.length === 7 ? `0${cepDig}` : cepDig.length === 8 ? cepDig : '';
    const nulo = (v: string) => (/^(null|-|n\/a|nao informado\.?)$/i.test(sa(v)) ? '' : v);
    const log = nulo(txt(get(row, 'logradouro')));
    const numero = nulo(txt(get(row, 'numero')));
    const qd = nulo(txt(get(row, 'quadra')));
    const lt = nulo(txt(get(row, 'lote')));
    const logradouro = [log ? padronizarNome(log) : '', numero ? `nº ${numero}` : '', qd ? `Qd. ${qd}` : '', lt ? `Lt. ${lt}` : ''].filter(Boolean).join(', ');
    const descBruta0 = nulo(txt(get(row, 'descricao')));
    // Entrega: coluna de data; se não tiver, "entregue em setembro de 1995" no texto
    let entrega = lerEntrega(nulo(txt(get(row, 'entrega'))) || undefined) ?? lerEntrega(get(row, 'entrega') instanceof Date ? get(row, 'entrega') : undefined);
    if (!entrega && descBruta0) {
      const frase = sa(descBruta0).match(/(entregue|entrega|conclu[a-z]*|habite-?se)[^.]{0,60}?((jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*(de\s*)?\/?\s*\d{4}|\b(19|20)\d{2}\b)/);
      if (frase) entrega = lerEntrega(frase[2]);
    }
    const pub = sa(txt(get(row, 'publicado')));
    const numOuNada = (v: unknown) => {
      const n = Number(String(v ?? '').replace(',', '.'));
      return Number.isFinite(n) && n !== 0 && Math.abs(n) <= 180 ? n : undefined;
    };
    const lat = numOuNada(get(row, 'lat'));
    const lng = numOuNada(get(row, 'lng'));
    const video = nulo(txt(get(row, 'video')));
    const pav = Number(String(get(row, 'pavimentos') ?? '').replace(/\D/g, '')) || undefined;
    const lazerTxt = sa(txt(get(row, 'lazer')));
    const amenities = lazerTxt ? AMENIDADES_PADRAO.filter((a) => AMENIDADE_REGRAS.find(([n]) => n === a)?.[1].test(lazerTxt)) : [];
    const tiposTxt0 = sa(txt(get(row, 'tipos')));
    // TipoUso de sistemas: 1 residencial, 2 comercial, 3 misto
    const tiposTxt = tiposTxt0 === '2' ? 'comercial' : tiposTxt0 === '3' ? (tipo === 'vertical' ? 'apartamento comercial' : 'casa comercial') : /^\d$/.test(tiposTxt0) ? '' : tiposTxt0;
    const tiposUnidade: TipoUnidade[] = tiposTxt
      ? ([
          [/apart|apto/, 'apartamento'],
          [/cobertura/, 'cobertura'],
          [/studio|studio/, 'studio'],
          [/flat/, 'flat'],
          [/sobrado/, 'sobrado'],
          [/casa/, 'casa_condominio'],
          [/lote|terreno/, 'terreno_lote'],
          [/sala|comercial/, 'sala_comercial']
        ] as [RegExp, TipoUnidade][])
          .filter(([re]) => re.test(tiposTxt))
          .map(([, t]) => t)
      : tipo === 'vertical'
        ? ['apartamento']
        : ['casa_condominio'];
    const descBruta = descBruta0;
    const descricao = ajustarDescricao(descBruta, [
      [nomeBruto, nome],
      [bairroBruto, bairro],
      [cidadeBruta, cidade]
    ]);
    const problemas: string[] = [];
    if (!bairro) problemas.push('sem bairro');
    if (!cidade) problemas.push('sem cidade');
    if (!entrega) problemas.push('sem data de entrega (entra como rascunho)');
    if (!cep) problemas.push('sem CEP');
    const chave = `${chaveNome(nome)}|${cep || sa(bairro) + sa(cidade)}`;
    const dup = vistos.has(chave);
    vistos.add(chave);
    out.push({
      linha: i + primeiraLinhaDados,
      nome,
      tipo,
      tiposUnidade,
      cep,
      uf: (txt(get(row, 'uf')) || (sa(cidade) === 'goiania' ? 'GO' : '')).toUpperCase().slice(0, 2),
      cidade,
      bairro,
      logradouro,
      entrega,
      descricao,
      pavimentos: pav,
      amenities,
      construtora: txt(get(row, 'construtora')) ? padronizarNome(txt(get(row, 'construtora'))) : undefined,
      problemas,
      duplicadaNaPlanilha: dup,
      rascunho: pub === '0' || pub === 'nao' || pub === 'false' || pub === 'rascunho',
      lat,
      lng,
      videoUrl: /youtu|instagram|vimeo/.test(video) ? video : undefined
    });
  });
  return out;
}

/** CSV simples (separador ; ou ,), com aspas */
export function lerCsv(texto: string): string[][] {
  const primeira = texto.split(/\r?\n/)[0] ?? '';
  const sep = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ';' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim()));
}

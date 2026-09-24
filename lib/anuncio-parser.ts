// Leitura por REGRAS (sem IA) de um anúncio avulso: texto colado, texto de um
// PDF ou texto lido de um print (OCR). Preenche o formulário do imóvel e monta
// a descrição já formatada (subtítulos, listas, negrito) — tudo revisável.
import type { TipoUnidade } from './tipologias';
import { AMENIDADES_PADRAO } from './amenidades';
import { formatTitulo } from './text';
import { AMENIDADE_REGRAS, parseArea, parseMesAno, parseEndereco, semAcento } from './pdf-import/parse';

export type AnuncioExtraido = {
  titulo?: string;
  tipoUnidade?: TipoUnidade;
  finalidade?: 'venda' | 'aluguel';
  priceValue?: number;
  pricePeriod?: 'unico' | 'mensal';
  area?: number;
  quartos?: number;
  vagas?: number;
  banheiros?: number;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  condominio?: string;
  deliveryDate?: string;
  aceitaTemporada?: boolean;
  amenities: string[];
  description: string;
  encontrados: string[]; // o que foi reconhecido (para mostrar na tela)
};

const TIPOS: [TipoUnidade, RegExp][] = [
  ['cobertura_duplex', /cobertura\s+duplex/],
  ['apartamento_garden', /(apartamento|apto)\.?\s+garden|\bgarden\b/],
  ['apartamento_triplex', /triplex/],
  ['apartamento_duplex', /(apartamento|apto)\.?\s+duplex|\bduplex\b/],
  ['penthouse', /penthouse/],
  ['cobertura', /cobertura/],
  ['sobrado', /sobrado/],
  ['casa_condominio', /casa\s+(em|de)\s+condom[ií]nio|casa.{0,40}condom[ií]nio fechado/],
  ['chacara_sitio_fazenda', /ch[aá]cara|s[ií]tio|fazenda/],
  ['terreno_lote', /\blote\b|terreno/],
  ['galpao', /galp[aã]o/],
  ['loja_ponto_comercial', /\bloja\b|ponto comercial/],
  ['sala_comercial', /sala comercial|\bsala\b.{0,20}comercial|consult[oó]rio/],
  ['predio_comercial', /pr[eé]dio comercial/],
  ['studio', /\bstudio\b|\bst[uú]dio\b/],
  ['flat', /\bflat\b/],
  ['loft', /\bloft\b/],
  ['casa', /\bcasa\b/],
  ['apartamento', /apartamento|\bapto\b|\bap\b/]
];

const CIDADES_GO = ['Aparecida de Goiânia', 'Goiânia', 'Anápolis', 'Senador Canedo', 'Trindade', 'Caldas Novas', 'Rio Verde', 'Brasília', 'Pirenópolis', 'Hidrolândia', 'Goianira', 'Nerópolis', 'Bela Vista de Goiás'];
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

const num = (s?: string) => (s ? Number(s) : undefined);

function valorBRL(s: string): number | undefined {
  const m = s.match(/(\d{1,3}(?:\.\d{3})+|\d{4,})(?:,\d{2})?/);
  if (!m) return undefined;
  const n = Number(m[0].replace(/\./g, '').replace(',', '.'));
  // "1,2 milhão" / "850 mil"
  return Number.isFinite(n) ? n : undefined;
}

function valorPorExtenso(s: string): number | undefined {
  const m = semAcento(s.toLowerCase()).match(/(\d+(?:[.,]\d+)?)\s*(milhao|milhoes|mi\b|mil\b)/);
  if (!m) return undefined;
  const base = Number(m[1].replace(',', '.'));
  return m[2].startsWith('mil') && m[2] !== 'milhao' && m[2] !== 'milhoes' ? base * 1000 : base * 1_000_000;
}

// Tira telefone, e-mail, links e CRECI de terceiros da descrição
function limparContato(l: string): string {
  return l
    .replace(/https?:\/\/\S+|www\.\S+/gi, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '')
    .replace(/\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '')
    .replace(/creci[^,\n]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Monta a descrição no formato do site: "## Subtítulo", "- lista", "**negrito**" */
export function formatarDescricao(texto: string, tirarLinha?: string): string {
  if (tirarLinha) texto = texto.replace(tirarLinha, '');
  const linhas = texto.replace(/\r/g, '').split('\n').map((l) => limparContato(l.replace(/\t/g, ' ')));
  const out: string[] = [];
  for (let raw of linhas) {
    if (!raw) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    // marcadores comuns (•, ✓, ✅, ▪, ➡, emojis, "- ", "* ")
    const bullet = raw.match(/^\s*(?:[-*•·▪▫◦●○✓✔✅☑→►🔹🔸]\uFE0F?\s*)+(.*)$/u);
    if (bullet && bullet[1].trim()) {
      out.push(`- ${bullet[1].trim()}`);
      continue;
    }
    raw = raw.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();
    if (!raw || /^[\W_]{0,3}$/.test(raw)) continue;
    if (/^(fale comigo|fale conosco|contato|whats(app)?|ligue|chame)\b/i.test(raw)) continue;
    // Linha curta terminando com ":" ou TODA EM MAIÚSCULAS vira subtítulo
    const semDoisPontos = raw.replace(/:$/, '');
    if ((raw.endsWith(':') && raw.length <= 45) || (raw.length <= 45 && raw === raw.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(raw) && !/\d/.test(raw))) {
      const t = formatTitulo(semDoisPontos.toLowerCase());
      out.push('', `## ${t}`);
      continue;
    }
    out.push(raw);
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extrairAnuncio(texto: string): AnuncioExtraido {
  const t = texto.replace(/\r/g, '');
  const lower = semAcento(t.toLowerCase());
  const linhas = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const r: AnuncioExtraido = { amenities: [], description: '', encontrados: [] };
  const achou = (s: string) => r.encontrados.push(s);

  // Título: primeira linha "de título" (sem preço, curta)
  const tit = linhas.find((l) => l.length >= 8 && l.length <= 110 && !/r\$|^\d|whats|telefone|creci/i.test(l));
  if (tit) r.titulo = tit.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').replace(/[.!]+$/, '');

  // Tipo
  for (const [tipo, re] of TIPOS) {
    if (re.test(lower)) {
      r.tipoUnidade = tipo;
      break;
    }
  }

  // Finalidade e preço
  const aluguel = /\baluguel\b|\balugar\b|\bloca[cç][aã]o\b|para locar|\/\s?m[eê]s|por m[eê]s/.test(lower);
  const venda = /\bvenda\b|\bvende-?se\b|\bà venda\b|\ba venda\b/.test(lower);
  r.finalidade = aluguel && !venda ? 'aluguel' : 'venda';
  const linhasPreco = linhas.filter((l) => /r\$|valor|pre[cç]o|venda|aluguel/i.test(l) && !/condom[ií]nio|iptu|taxa|entrada|parcela|financ/i.test(l));
  const candidatos = linhasPreco.map((l) => valorBRL(l) ?? valorPorExtenso(l)).filter((v): v is number => !!v && v >= 300);
  if (candidatos.length) {
    r.priceValue = r.finalidade === 'aluguel' ? Math.min(...candidatos.filter((v) => v < 100000).concat(candidatos)) : Math.max(...candidatos);
    r.pricePeriod = r.finalidade === 'aluguel' ? 'mensal' : 'unico';
    achou(`Valor: R$ ${r.priceValue.toLocaleString('pt-BR')}`);
  }

  // Área: privativa/útil/construída primeiro
  const linhaArea =
    linhas.find((l) => /(privativa|[uú]til|constru[ií]da|área total do apto)/i.test(l) && parseArea(l)) ??
    linhas.find((l) => parseArea(l) && !/terreno|lote/i.test(l)) ??
    linhas.find((l) => parseArea(l));
  const area = linhaArea ? parseArea(linhaArea) : undefined;
  if (area && area >= 15 && area <= 100000) {
    r.area = Math.round(area * 100) / 100;
    achou(`Área: ${r.area.toLocaleString('pt-BR')} m²`);
  }

  // Quartos / suítes / vagas / banheiros
  const q = lower.match(/(\d{1,2})\s*(?:quartos?|dormit[oó]rios?|dorms?\b|qts?\b)/);
  const s = lower.match(/(\d{1,2})\s*su[ií]tes?/);
  r.quartos = num(q?.[1]) ?? num(s?.[1]);
  if (!r.quartos && /\bsuite\b/.test(lower) && r.tipoUnidade === 'studio') r.quartos = 1;
  const v = lower.match(/(\d{1,2})\s*(?:vagas?|garagens?)\b/);
  r.vagas = num(v?.[1]);
  const b = lower.match(/(\d{1,2})\s*(?:banheiros?|wcs?\b|lavabos?)/);
  r.banheiros = num(b?.[1]);
  if (r.quartos) achou(`${r.quartos} quarto(s)`);
  if (r.vagas) achou(`${r.vagas} vaga(s)`);
  if (r.banheiros) achou(`${r.banheiros} banheiro(s)`);

  // Endereço
  const cep = t.match(/\b(\d{5})-?(\d{3})\b/);
  if (cep) {
    r.cep = `${cep[1]}${cep[2]}`;
    achou(`CEP ${cep[1]}-${cep[2]}`);
  }
  const linhaEnd = linhas.find((l) => /^(endere[cç]o|localiza[cç][aã]o|local)\s*:/i.test(l));
  if (linhaEnd) {
    const e = parseEndereco(linhaEnd.replace(/^[^:]+:\s*/, ''));
    Object.assign(r, { logradouro: e.logradouro || undefined, bairro: e.bairro || undefined, cidade: e.cidade || undefined, uf: e.uf || undefined });
  }
  if (!r.bairro) {
    // Setor/Jardim/Vila... (maiúsculas ou não); "Residencial X" costuma ser o condomínio
    const titulo = (w: string) => w.toLowerCase().replace(/(^|\s)(\S)/g, (_m, a, c) => a + c.toUpperCase()).replace(/\s(D[aeo]s?)\s/g, (m) => m.toLowerCase());
    const bm = t.match(/\b(Setor|SETOR|St\.|Jardim|JARDIM|Jd\.|Parque|PARQUE|Vila|VILA|Bairro|BAIRRO)[ \t]+([A-ZÀ-Ú][\wÀ-ú]+(?:[ \t]+(?:[A-ZÀ-Ú][\wÀ-ú]+|d[aeo]s?|I{1,3}))*)/);
    if (bm) {
      const pref = bm[1].replace(/^St\.$/, 'Setor').replace(/^Jd\.$/, 'Jardim');
      const nome = bm[2].split(/\s+[-–]\s+|\s+(?:NO|NA|EM|COM|DE)\s+/)[0];
      r.bairro = titulo(`${pref} ${nome}`).replace(/^Bairro /, '');
    }
  }
  if (!r.cidade) {
    const cid = CIDADES_GO.find((c) => lower.includes(semAcento(c.toLowerCase())));
    if (cid) {
      r.cidade = cid;
      r.uf = cid === 'Brasília' ? 'DF' : 'GO';
    }
    const cu = t.match(/([A-ZÀ-Ú][\wÀ-ú]+(?:\s+[\wÀ-ú]+){0,3})\s*[/-]\s*([A-Z]{2})\b/);
    if (!r.cidade && cu && UFS.includes(cu[2])) {
      r.cidade = cu[1];
      r.uf = cu[2];
    }
  }
  if (r.bairro || r.cidade) achou(`Local: ${[r.bairro, r.cidade].filter(Boolean).join(', ')}`);

  // Condomínio
  const cm = t.match(/\b(?:Condom[ií]nio|Residencial|Edif[ií]cio|Ed\.|Torre)[ \t]+([A-ZÀ-Ú0-9][\wÀ-ú0-9'’]*(?:[ \t]+(?:[A-ZÀ-Ú0-9][\wÀ-ú0-9'’]*|d[aeo]s?|&))*)/);
  if (cm && !/fechado|horizontal|vertical/i.test(cm[1])) {
    r.condominio = cm[0].replace(/^Ed\.\s*/, 'Edifício ').trim();
    achou(`Condomínio: ${r.condominio}`);
  }

  // Entrega / ano de construção
  const ent = linhas.find((l) => /(entrega|entregue|ano de constru|constru[ií]do em|pronto em|habite-?se)/i.test(l));
  if (ent) {
    const d = parseMesAno(ent) ?? (ent.match(/\b(19[5-9]\d|20[0-4]\d)\b/)?.[1] ? `${ent.match(/\b(19[5-9]\d|20[0-4]\d)\b/)![1]}-01` : undefined);
    if (d) {
      r.deliveryDate = d;
      achou(`Entrega: ${d}`);
    }
  } else if (/pronto para morar|pronta entrega/.test(lower)) {
    // sem ano: deixa para preencher
  }

  r.aceitaTemporada = /temporada|airbnb/.test(lower);
  r.amenities = AMENIDADES_PADRAO.filter((a) => AMENIDADE_REGRAS.find(([n]) => n === a)?.[1].test(lower));
  if (r.amenities.length) achou(`Lazer: ${r.amenities.join(', ')}`);

  // A primeira linha já vira o título do anúncio — não repete na descrição
  const primeira = t.split('\n').find((l) => l.trim())?.trim();
  r.description = formatarDescricao(t, primeira && r.titulo && primeira.includes(r.titulo.slice(0, 20)) ? primeira : undefined);
  return r;
}

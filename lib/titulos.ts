// Títulos para o Google (tag <title>): entre 50 e 60 caracteres, palavra-chave
// no início e a fórmula escolhida pela FASE do imóvel:
//   Lançamento / obras  → "Lançamento no Setor Bueno: Apartamentos de 2 e 3 Quartos | Opus"
//   Pronto novo         → "Apartamento Pronto para Morar no Marista - 118 m² | Marista 262"
//   Demais              → "Apartamentos de 2 e 3 Quartos no Setor Bueno | Opus Acqua"
//   Casa nova           → "Comprar Casa Nova no Aldeia do Vale - 4 Quartos"
// Cada função monta várias opções, da mais completa para a mais curta, e usa a
// primeira que cabe em 60 caracteres (sem cortar palavra no meio).
import { TIPO_UNIDADE_LABEL, ehCasa, type TipoUnidade } from './tipologias';
import { getStatusBucket, ehFutura, temEntrega, type StatusBucket } from './classification';

export const TITULO_MAX = 60;
export const TITULO_MIN = 50;

/** Título curto (abaixo de 50) ganha a marca ou a cidade no fim, sem passar de 60 */
export function completar(t: string): string {
  if (t.length >= TITULO_MIN) return t;
  for (const fim of [' | Mais Novos Imóveis', ' | Mais Novos', ' | Goiânia']) if ((t + fim).length <= TITULO_MAX) return t + fim;
  return t;
}

/** Primeira opção que cabe; se nenhuma couber, corta a última numa palavra inteira */
export function caber(opcoes: (string | null | undefined | false)[], max = TITULO_MAX): string {
  const lista = opcoes.filter((o): o is string => !!o).map((o) => o.replace(/\s+/g, ' ').trim());
  const boa = lista.find((o) => o.length <= max);
  if (boa) return boa;
  const ult = lista[lista.length - 1] ?? '';
  return ult.slice(0, max + 1).replace(/\s+\S*$/, '').replace(/[\s|:,-]+$/, '');
}

const PLURAL: Partial<Record<TipoUnidade, string>> = {
  apartamento: 'Apartamentos',
  apartamento_garden: 'Apartamentos Garden',
  apartamento_duplex: 'Apartamentos Duplex',
  cobertura: 'Coberturas',
  cobertura_duplex: 'Coberturas Duplex',
  penthouse: 'Penthouses',
  studio: 'Studios',
  flat: 'Flats',
  loft: 'Lofts',
  casa: 'Casas',
  casa_condominio: 'Casas em Condomínio',
  sobrado: 'Sobrados',
  terreno_lote: 'Lotes',
  sala_comercial: 'Salas Comerciais',
  loja_ponto_comercial: 'Lojas'
};
const COMERCIAIS = ['sala_comercial', 'loja_ponto_comercial', 'galpao', 'predio_comercial'];

/** "2 e 3" / "1 a 4" / "3" */
export function faixaQuartos(qs: number[]): string {
  const v = Array.from(new Set(qs.filter((n) => n > 0))).sort((a, b) => a - b);
  if (!v.length) return '';
  if (v.length === 1) return String(v[0]);
  if (v.length === 2) return `${v[0]} e ${v[1]}`;
  return `${v[0]} a ${v[v.length - 1]}`;
}
const quartosTxt = (qs: number[]) => {
  const f = faixaQuartos(qs);
  return f ? `${f} ${f === '1' ? 'Quarto' : 'Quartos'}` : '';
};
/** Encurta nomes de bairro comuns quando o espaço aperta ("Setor Marista" → "Marista") */
const bairroCurto = (b: string) => {
  const c = b.replace(/^(Setor|St\.?|Jardim|Jd\.?|Vila|Parque|Residencial)\s+/i, '');
  // "Jardim Goiás" não vira "Goiás" (confunde com o estado); nomes muito curtos ficam inteiros
  return /^goi[aá]s$/i.test(c) || c.length < 5 ? b : c;
};

const fase = (entrega?: string | null): StatusBucket | null => (temEntrega(entrega) ? getStatusBucket(entrega) : null);

// ---------------- Condomínio / empreendimento ----------------
export function tituloCondominio(d: {
  name: string;
  bairro?: string | null;
  cidade?: string | null;
  deliveryDate?: string | null;
  tipo?: 'vertical' | 'horizontal' | string;
  tiposUnidade?: TipoUnidade[];
  quartos?: number[];
}): string {
  const nome = d.name.trim();
  const bairro = d.bairro || d.cidade || 'Goiânia';
  const tipos = (d.tiposUnidade ?? []).filter((t) => PLURAL[t]);
  const principal: TipoUnidade | undefined =
    tipos.find((t) => !['penthouse', 'cobertura', 'cobertura_duplex', 'apartamento_garden'].includes(t)) ?? tipos[0];
  const tipoPl = principal ? PLURAL[principal]! : d.tipo === 'horizontal' ? 'Casas em Condomínio' : 'Apartamentos';
  const q = COMERCIAIS.includes(principal ?? '') ? '' : quartosTxt(d.quartos ?? []);
  const f = fase(d.deliveryDate);

  // As buscas que trazem gente ao portal são pelo NOME do condomínio: o nome vem primeiro
  // (aparece inteiro e em negrito no Google, mesmo no celular, que corta o fim do título).
  if (f && ehFutura(f)) {
    return completar(caber([
      q && `${nome}: Lançamento no ${bairro}, ${tipoPl} de ${q}`,
      q && `${nome}: Lançamento no ${bairro}, ${q}`,
      q && `${nome}: Lançamento no ${bairroCurto(bairro)}, ${q}`,
      `${nome}: Lançamento no ${bairro}`,
      `${nome}: Lançamento no ${bairroCurto(bairro)}`,
      `${nome}: Lançamento`
    ]));
  }
  if (f === 'novo') {
    return completar(caber([
      q && `${nome}: ${tipoPl} de ${q} Prontos no ${bairro}`,
      q && `${nome}: ${tipoPl} de ${q} no ${bairroCurto(bairro)}`,
      `${nome}: Pronto para Morar no ${bairro}`,
      `${nome}: Pronto para Morar no ${bairroCurto(bairro)}`,
      `${nome}, ${bairroCurto(bairro)}`
    ]));
  }
  return completar(caber([
    q && `${nome}: ${tipoPl} de ${q} no ${bairro}`,
    q && `${nome}: ${tipoPl} de ${q} no ${bairroCurto(bairro)}`,
    `${nome}: ${tipoPl} à Venda no ${bairro}`,
    `${nome}: ${tipoPl} à Venda no ${bairroCurto(bairro)}`,
    `${nome}, ${bairroCurto(bairro)}: Fotos e Plantas`,
    `${nome}, ${bairroCurto(bairro)}`,
    nome
  ]));
}

// ---------------- Anúncio (imóvel avulso) ----------------
export function tituloAnuncio(p: {
  tipoUnidade: TipoUnidade;
  finalidade?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  condominio?: string | null;
  deliveryDate?: string | null;
  quartos?: number | null;
  areaValue?: number | null;
}): string {
  const tipo = p.tipoUnidade === 'casa_condominio' ? 'Casa em Condomínio' : TIPO_UNIDADE_LABEL[p.tipoUnidade] ?? 'Imóvel';
  const tipoCurto = p.tipoUnidade === 'casa_condominio' ? 'Casa' : tipo;
  const bairro = p.bairro || p.cidade || 'Goiânia';
  const cond = p.condominio?.trim() || '';
  const q = COMERCIAIS.includes(p.tipoUnidade) ? '' : quartosTxt(p.quartos ? [p.quartos] : []);
  const m2 = p.areaValue ? `${Math.round(p.areaValue)} m²` : '';
  const acao = p.finalidade === 'aluguel' ? 'para Alugar' : 'à Venda';
  const marca = cond ? ` | ${cond}` : '';
  const f = fase(p.deliveryDate);

  if (p.finalidade !== 'aluguel' && f && ehFutura(f)) {
    return completar(caber([
      q && `${tipoCurto} na Planta no ${bairro} - ${q}${marca}`,
      q && `${tipoCurto} na Planta no ${bairroCurto(bairro)} - ${q}${marca}`,
      `${tipoCurto} na Planta no ${bairro}${marca}`,
      q && `${tipoCurto} na Planta no ${bairroCurto(bairro)} - ${q}`,
      `${tipoCurto} na Planta no ${bairroCurto(bairro)}`
    ]));
  }
  if (p.finalidade !== 'aluguel' && f === 'novo') {
    // casa nova: busca transacional (\"comprar casa nova em ...\")
    if (ehCasa(p.tipoUnidade) && p.tipoUnidade !== 'terreno_lote') {
      const onde = cond || bairro;
      return completar(caber([
        q && `Comprar Casa Nova no ${onde} - ${q}`,
        q && `Comprar Casa Nova no ${bairroCurto(onde)} - ${q}`,
        `Comprar Casa Nova no ${bairroCurto(onde)}`
      ]));
    }
    return completar(caber([
      m2 && `${tipoCurto} Pronto para Morar no ${bairro} - ${m2}${marca}`,
      m2 && `${tipoCurto} Pronto para Morar no ${bairroCurto(bairro)} - ${m2}${marca}`,
      m2 && `${tipoCurto} Pronto para Morar no ${bairroCurto(bairro)} - ${m2}`,
      `${tipoCurto} Pronto para Morar no ${bairroCurto(bairro)}${marca}`,
      `${tipoCurto} Pronto para Morar no ${bairroCurto(bairro)}`
    ]));
  }
  return completar(caber([
    q && `${tipo} de ${q} ${acao} no ${bairro}${marca}`,
    q && `${tipoCurto} de ${q} ${acao} no ${bairroCurto(bairro)}${marca}`,
    m2 && `${tipoCurto} ${acao} no ${bairro} - ${m2}${marca}`,
    q && `${tipoCurto} de ${q} ${acao} no ${bairroCurto(bairro)}`,
    `${tipoCurto} ${acao} no ${bairroCurto(bairro)}${m2 ? ` - ${m2}` : ''}`,
    `${tipoCurto} ${acao} no ${bairroCurto(bairro)}`
  ]));
}

// ---------------- Páginas de bairro/cidade ----------------
export function tituloRegiao(oQue: string, bairro: string | null | undefined, cidade: string, n?: number): string {
  const onde = bairro ? `no ${bairro}` : `em ${cidade}`;
  const ondeCurto = bairro ? `no ${bairroCurto(bairro)}` : `em ${cidade}`;
  return completar(caber([
    n && n > 1 && bairro ? `${oQue} à Venda ${onde}, ${cidade}: ${n} Opções` : null,
    n && n > 1 ? `${oQue} à Venda ${onde}: ${n} Opções` : null,
    bairro ? `${oQue} à Venda ${onde}, ${cidade}` : null,
    `${oQue} à Venda ${onde}`,
    `${oQue} à Venda ${ondeCurto}`
  ]));
}

// ---------------- Construtora / incorporadora ----------------
export function tituloEmpresa(frase: string): string {
  const f = frase.replace(/ à venda /, ' à Venda ');
  return completar(caber([`${f}: Lançamentos e Prontos`, `${f}: Lançamentos`, f]));
}

export const TITULO_HOME = 'Os Mais Novos Imóveis à Venda estão aqui | Goiânia';

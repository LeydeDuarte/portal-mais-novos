// Texto que acompanha o link enviado ao cliente (WhatsApp ou copiar), no formato:
//   Casa - Aldeia do Vale - 4 Quartos - 450m² - por: R$ 4.000.000
//   https://maisnovosimoveis.com/imovel/a-venda/go/goiania/...
// Casa, sobrado, lote e chácara mostram o nome do condomínio; apartamento e
// imóvel de rua mostram o bairro. Sala comercial não mostra quartos.
import { TIPO_UNIDADE_LABEL, ehCasa, type TipoUnidade } from './tipologias';

const COMERCIAIS = ['sala_comercial', 'loja_ponto_comercial', 'galpao', 'predio_comercial'];
const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
const m2 = (v: number) => `${Math.round(v).toLocaleString('pt-BR')}m²`;

export type DadosLinhaImovel = {
  tipo: string;
  finalidade?: string | null;
  condominio?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  quartos?: number | null;
  area?: number | null;
  preco?: number | null;
};

export function linhaImovel(i: DadosLinhaImovel): string {
  const tipo = i.tipo === 'casa_condominio' ? 'Casa' : TIPO_UNIDADE_LABEL[i.tipo as TipoUnidade] ?? 'Imóvel';
  const lugar = (ehCasa(i.tipo) && i.condominio ? i.condominio : i.bairro || i.condominio || i.cidade) ?? '';
  const q = i.quartos ?? 0;
  const quartos = COMERCIAIS.includes(i.tipo) || q <= 0 ? '' : `${q} ${q === 1 ? 'Quarto' : 'Quartos'}`;
  const area = i.area && i.area > 0 ? m2(i.area) : '';
  const preco = i.preco && i.preco > 0 ? `por: ${brl(i.preco)}${i.finalidade === 'aluguel' ? '/mês' : ''}` : '';
  return [tipo, lugar, quartos, area, preco].filter(Boolean).join(' - ');
}

export type DadosLinhaCondominio = {
  nome: string;
  bairro?: string | null;
  cidade?: string | null;
  quartosMin?: number | null;
  quartosMax?: number | null;
  areaMin?: number | null;
  areaMax?: number | null;
  aPartirDe?: number | null;
};

const faixa = (a?: number | null, b?: number | null, fmt = (n: number) => String(n), junta = ' a ') =>
  a != null && b != null && a !== b ? `${fmt(a)}${junta}${fmt(b)}` : a != null ? fmt(a) : b != null ? fmt(b) : '';

export function linhaCondominio(c: DadosLinhaCondominio): string {
  const q = faixa(c.quartosMin, c.quartosMax, String, ' e ');
  const quartos = q ? `${q} ${c.quartosMax === 1 ? 'Quarto' : 'Quartos'}` : '';
  const area = faixa(c.areaMin, c.areaMax, (n) => String(Math.round(n)), ' a ');
  const preco = c.aPartirDe && c.aPartirDe > 0 ? `a partir de: ${brl(c.aPartirDe)}` : '';
  return [c.nome, c.bairro || c.cidade, quartos, area ? `${area}m²` : '', preco].filter(Boolean).join(' - ');
}

/** Mensagem pronta: a linha do anúncio e o link logo abaixo */
export const mensagemComLink = (linha: string, url: string, antes?: string, depois?: string) =>
  [antes, `${linha}\n${url}`, depois].filter(Boolean).join('\n\n');

// ---------------- mensagem ao proprietário ----------------
export type DadosImovelProprietario = DadosLinhaImovel & {
  titulo?: string | null;
  unidade?: string | null;
  quadra?: string | null;
  lote?: string | null;
  complemento?: string | null;
};

/** "unidade 1502" ou "Quadra 05, Lote 18" (campos próprios; se vazios, tenta ler o complemento) */
export function identificacaoImovel(i: DadosImovelProprietario): string {
  if (i.unidade?.trim()) return `unidade ${i.unidade.trim()}`;
  if (i.quadra?.trim() || i.lote?.trim()) return [i.quadra?.trim() ? `Quadra ${i.quadra.trim()}` : '', i.lote?.trim() ? `Lote ${i.lote.trim()}` : ''].filter(Boolean).join(', ');
  const c = i.complemento ?? '';
  const ql = c.match(/\bq(?:d|uadra)?\.?\s*(\w{1,5})\W+l(?:t|ote)?\.?\s*(\w{1,5})\b/i);
  if (ql) return `Quadra ${ql[1]}, Lote ${ql[2]}`;
  const un = c.match(/\b(?:ap(?:to|t|artamento)?|unidade|sala|un)\.?\s*(\d{1,5}[a-z]?)\b/i);
  if (un) return `unidade ${un[1]}`;
  return '';
}

/**
 * Mensagem para o WhatsApp do proprietário:
 * "Olá! Tenho cliente com interesse em agendar visita no imóvel (Apartamento 3 quartos no Marista 262, unidade 1502).
 *  Já foi vendido ou está disponível?"
 */
export function mensagemProprietario(i: DadosImovelProprietario): string {
  const tipo = i.tipo === 'casa_condominio' ? 'Casa' : TIPO_UNIDADE_LABEL[i.tipo as TipoUnidade] ?? 'Imóvel';
  const q = i.quartos ?? 0;
  const reserva = [`${tipo}${q > 0 && !COMERCIAIS.includes(i.tipo) ? ` de ${q} ${q === 1 ? 'quarto' : 'quartos'}` : ''}`, i.area ? m2(i.area) : '', !i.condominio && i.bairro ? i.bairro : '']
    .filter(Boolean)
    .join(', ');
  const titulo = i.titulo?.trim() || reserva;
  const cond = i.condominio?.trim();
  const comCond = cond && !titulo.toLowerCase().includes(cond.toLowerCase()) ? `${titulo}, ${cond}` : titulo;
  const id = identificacaoImovel(i);
  return `Olá! Tenho cliente com interesse em agendar visita no imóvel (${[comCond, id].filter(Boolean).join(', ')}). Já foi vendido ou está disponível?`;
}

/** Link do WhatsApp para um número (com DDD), já com a mensagem */
export function linkWhatsapp(numero?: string | null, texto?: string): string | null {
  const n = (numero ?? '').replace(/\D/g, '');
  if (n.length < 10) return null;
  const tel = n.length <= 11 ? `55${n}` : n;
  return `https://wa.me/${tel}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

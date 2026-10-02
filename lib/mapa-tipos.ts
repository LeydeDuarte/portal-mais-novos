// Pontos do mapa (painel da equipe; depois o site público usa o mesmo formato).
// Imóvel avulso: etiqueta com o preço. Condomínio: etiqueta com "a partir de",
// colorida pela fase; seminovo/usado/antigo sem anúncio ficam cinza ("apagados").

export type PontoImovel = {
  tipo: 'imovel';
  id: string;
  lat: number;
  lng: number;
  nome: string;
  tipoUnidade: string | null;
  preco: number | null;
  quartos: number | null;
  vagas: number | null;
  area: number | null;
  entrega: string | null; // "AAAA-MM"
  bairro: string | null;
  cidade: string | null;
  capa: string | null;
  url: string;
  /** condomínio ao qual o anúncio está ligado (no mapa ele entra dentro do ponto do condomínio) */
  condominioId: string | null;
  privado: boolean;
  /** posição aproximada (imóvel de rua): desenha um círculo, não um ponto exato */
  aproximada: boolean;
  /** sem posição própria: usa a do condomínio */
  herdaPosicao: boolean;
  podeMover: boolean;
  /** vendido há até 30 dias: aparece em vermelho ("AAAA-MM-DD") */
  vendidoEm: string | null;
  /** mapa público: quem anunciou (foto, primeiro nome e WhatsApp de trabalho) */
  anunciante?: { nome: string; foto: string | null; whatsapp: string };
  /** SÓ NO PAINEL: proprietário do imóvel (nunca vai para o mapa público) */
  dono?: { nome: string; whatsapp: string | null } | null;
};

export type PontoCondominio = {
  tipo: 'condominio';
  id: string;
  lat: number;
  lng: number;
  nome: string;
  horizontal: boolean;
  /** menor preço das tipologias/anúncios públicos ("a partir de") */
  preco: number | null;
  anuncios: number;
  privados: number;
  entrega: string | null;
  bairro: string | null;
  cidade: string | null;
  capa: string | null;
  url: string;
  /** como a posição foi obtida: ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER, APPROXIMATE, MANUAL */
  precisao: string | null;
  podeMover: boolean;
  /** construtoras/incorporadoras ligadas ao condomínio, na ordem do cadastro */
  empresas: { nome: string; slug: string | null }[];
};

export type PontoMapa = PontoImovel | PontoCondominio;

export type ResultadoMapa = { pontos: PontoMapa[]; semPosicao: number };

/** Preço curto para a etiqueta: "R$ 850 mil", "R$ 1,2 mi" */
export function precoCurto(v: number | null | undefined): string {
  if (!v || v <= 0) return '';
  if (v >= 1_000_000) {
    const mi = v / 1_000_000;
    return `R$ ${mi.toLocaleString('pt-BR', { maximumFractionDigits: mi >= 10 ? 0 : 1 })} mi`;
  }
  return `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil`;
}

/** Link do WhatsApp para um telefone brasileiro (com ou sem 55), com mensagem pronta */
export function linkWhatsapp(telefone: string | null | undefined, mensagem: string): string | null {
  let d = (telefone ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12 || d.length > 13) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}`;
}

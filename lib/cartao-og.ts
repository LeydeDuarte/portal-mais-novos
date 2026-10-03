import { createHmac, timingSafeEqual } from 'crypto';
import { SITE_NAME, SITE_URL } from './seo';

// Cartão de compartilhamento (WhatsApp, Facebook, LinkedIn...) para páginas sem foto:
// logo completa "maisnovosimoveis.com", selo opcional, título e uma linha de apoio.
// O endereço da imagem vai ASSINADO: o gerador (/api/og) só desenha o que o próprio
// portal pediu, para ninguém usar o nosso domínio para gerar imagens com outro texto.
export type DadosCartao = { titulo: string; sub?: string | null; selo?: string | null };

const limpar = (t: string | null | undefined, max: number) => (t ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const segredo = () => process.env.SESSION_SECRET || '';

export function assinarCartao(d: DadosCartao): string {
  return createHmac('sha256', `og:${segredo()}`)
    .update(`${limpar(d.titulo, 90)}\n${limpar(d.sub, 120)}\n${limpar(d.selo, 30)}`)
    .digest('base64url')
    .slice(0, 22);
}

export function cartaoValido(d: DadosCartao, k: string | null): boolean {
  if (!k || !segredo()) return false;
  const a = Buffer.from(assinarCartao(d));
  const b = Buffer.from(k);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Endereço da imagem do cartão (1200 × 630), já assinado. */
export function urlCartao(d: DadosCartao): string {
  const p = new URLSearchParams({ t: limpar(d.titulo, 90) });
  if (d.sub) p.set('s', limpar(d.sub, 120));
  if (d.selo) p.set('selo', limpar(d.selo, 30));
  p.set('k', assinarCartao(d));
  return `${SITE_URL}/api/og?${p.toString()}`;
}

/** Pedaço de metadados com o cartão como imagem de compartilhamento. */
export function imagemCartao(d: DadosCartao) {
  const url = urlCartao(d);
  return {
    images: [{ url, width: 1200, height: 630, alt: `${d.titulo} | ${SITE_NAME}` }],
    twitter: { card: 'summary_large_image' as const, images: [url] }
  };
}

/** Cartão padrão do portal (página inicial e páginas sem cartão próprio). */
export const CARTAO_PADRAO: DadosCartao = {
  titulo: 'Os mais novos imóveis à venda em Goiânia',
  sub: 'Lançamentos, apartamentos e casas em condomínio'
};

import type { Metadata } from 'next';
import type { PropertyDetail, Development } from './property-details';
import type { Property } from './mock-properties';
import { getBadgeCondominio } from './classification';
import { TIPO_UNIDADE_LABEL, TIPO_UNIDADE_SCHEMA_ORG } from './tipologias';
import { descricaoTextoPuro } from './text';

// Domínio: variável NEXT_PUBLIC_SITE_URL (na troca para o domínio definitivo,
// basta mudar a variável na Vercel — canonical, sitemap, OG e schema acompanham).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://portal-mais-novos-imoveis.vercel.app').replace(/\/+$/, '');
export const SITE_NAME = 'Mais Novos Imóveis';
export const EMPRESA = {
  razao: 'Mais Novos Inteligência Imobiliária',
  cnpj: '36.006.396/0001-21',
  creci: 'CRECI C17586',
  instagram: 'https://www.instagram.com/leydeduarte.br',
  cidade: 'Goiânia',
  uf: 'GO'
};

// ---------- textos de SEO (título, descrição, alt das fotos) ----------
const num = (t?: string) => Number((t ?? '').match(/\d+/)?.[0] ?? 0) || undefined;
export function slugify(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
const brl = (v?: number) => (v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '');
const acao = (p: Property) => (p.finalidade === 'aluguel' ? 'para alugar' : 'à venda');
const onde = (p: Property) => [p.bairro, p.cidade].filter(Boolean).join(', ') || p.location;

/** "Apartamento à venda com 3 quartos, 120 m² — Setor Bueno, Goiânia" */
export function tituloSeoImovel(p: Property): string {
  const tipo = TIPO_UNIDADE_LABEL[p.tipoUnidade];
  const q = num(p.beds);
  const detalhes = [q ? `${q} ${q === 1 ? 'quarto' : 'quartos'}` : null, p.areaValue ? `${Math.round(p.areaValue)} m²` : null].filter(Boolean).join(', ');
  const partes = `${tipo} ${acao(p)}${detalhes ? ` com ${detalhes}` : ''}`;
  const local = p.condominio ? `${p.condominio}, ${p.bairro || p.cidade || ''}`.replace(/, $/, '') : onde(p);
  return `${partes} — ${local}`.slice(0, 95);
}

/** Descrição de ~155 caracteres com o que o buscador (e a pessoa) quer saber */
export function descricaoSeoImovel(p: Property): string {
  const tipo = TIPO_UNIDADE_LABEL[p.tipoUnidade];
  const q = num(p.beds);
  const v = num(p.parking);
  const bits = [
    `${tipo} ${acao(p)}${p.condominio ? ` no ${p.condominio}` : ''}, ${onde(p)}`,
    [q ? `${q} ${q === 1 ? 'quarto' : 'quartos'}` : null, v ? `${v} ${v === 1 ? 'vaga' : 'vagas'}` : null, p.areaValue ? `${Math.round(p.areaValue)} m²` : null]
      .filter(Boolean)
      .join(', '),
    p.priceValue ? brl(p.priceValue) + (p.finalidade === 'aluguel' ? '/mês' : '') : null
  ].filter(Boolean);
  const base = bits.join('. ') + '.';
  const extra = ' Fotos, vídeo e atendimento na Mais Novos Imóveis.';
  const texto = (base + extra).length <= 160 ? base + extra : base;
  return texto.slice(0, 160);
}

/** Texto alternativo das fotos: o que é + onde + "à venda" + marca (SEO de imagem) */
export function altFoto(p: Property, i?: number): string {
  const tipo = TIPO_UNIDADE_LABEL[p.tipoUnidade];
  return `${tipo} ${acao(p)}${p.condominio ? ` no ${p.condominio}` : ''}, ${onde(p)}${i != null ? ` — foto ${i + 1}` : ''} | ${SITE_NAME}`;
}

// ---------- metadados das páginas ----------
export function buildPropertyMetadata(property: PropertyDetail): Metadata {
  const title = property.titulo ? `${property.titulo} — ${onde(property)}`.slice(0, 95) : tituloSeoImovel(property);
  const description = descricaoSeoImovel(property);
  const url = `${SITE_URL}/imovel/${property.id}`;
  const imagem = property.photos?.[0];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'pt_BR',
      images: imagem ? [{ url: imagem, alt: altFoto(property) }] : undefined
    },
    twitter: { card: imagem ? 'summary_large_image' : 'summary', title, description, images: imagem ? [imagem] : undefined }
  };
}

function trilha(itens: { nome: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.nome, item: it.url }))
  };
}

/** Links "Início › Goiânia › Setor Bueno" (também usados na página) */
export function trilhaDoImovel(p: { cidade?: string; bairro?: string }): { nome: string; url: string }[] {
  const t = [{ nome: 'Início', url: SITE_URL }];
  if (p.cidade) t.push({ nome: `Imóveis em ${p.cidade}`, url: `${SITE_URL}/imoveis/${slugify(p.cidade)}` });
  if (p.cidade && p.bairro) t.push({ nome: p.bairro, url: `${SITE_URL}/imoveis/${slugify(p.cidade)}/${slugify(p.bairro)}` });
  return t;
}

export function buildPropertyJsonLd(property: PropertyDetail) {
  const url = `${SITE_URL}/imovel/${property.id}`;
  const nome = property.titulo || tituloSeoImovel(property);
  const quartos = num(property.beds);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        // o anúncio + o imóvel em si (Apartment, SingleFamilyResidence…)
        '@type': ['RealEstateListing', TIPO_UNIDADE_SCHEMA_ORG[property.tipoUnidade]],
        '@id': `${url}#anuncio`,
        name: nome,
        description: descricaoTextoPuro(property.description) || descricaoSeoImovel(property),
        url,
        image: (property.photos ?? []).slice(0, 10),
        address: {
          '@type': 'PostalAddress',
          addressLocality: property.cidade || undefined,
          addressRegion: 'GO',
          addressCountry: 'BR',
          streetAddress: property.bairro || undefined
        },
        containedInPlace: property.condominio ? { '@type': 'Residence', name: property.condominio } : undefined,
        numberOfRooms: quartos,
        numberOfBedrooms: quartos,
        floorSize: property.areaValue ? { '@type': 'QuantitativeValue', value: property.areaValue, unitCode: 'MTK' } : undefined,
        offers: property.priceValue
          ? {
              '@type': 'Offer',
              price: property.priceValue,
              priceCurrency: 'BRL',
              businessFunction: property.finalidade === 'aluguel' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell',
              availability: property.vendidoEm ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
              seller: { '@id': `${SITE_URL}/#empresa` }
            }
          : undefined
      },
      trilha([...trilhaDoImovel(property), { nome, url }])
    ]
  };
}

/** Home: quem somos (empresa) + o site com a busca interna (Google/IA entendem a busca) */
export function buildAgentJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['RealEstateAgent', 'Organization'],
        '@id': `${SITE_URL}/#empresa`,
        name: SITE_NAME,
        legalName: EMPRESA.razao,
        taxID: EMPRESA.cnpj,
        identifier: EMPRESA.creci,
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512.png`,
        image: `${SITE_URL}/icons/icon-512.png`,
        description:
          'Portal de imóveis à venda em Goiânia: apartamentos, casas em condomínio, lançamentos e imóveis novos, com vídeos e atendimento especializado em crédito imobiliário.',
        address: { '@type': 'PostalAddress', addressLocality: EMPRESA.cidade, addressRegion: EMPRESA.uf, addressCountry: 'BR' },
        areaServed: [
          { '@type': 'City', name: 'Goiânia' },
          { '@type': 'City', name: 'Aparecida de Goiânia' },
          { '@type': 'City', name: 'Senador Canedo' },
          { '@type': 'State', name: 'Goiás' }
        ],
        knowsAbout: ['imóveis à venda em Goiânia', 'lançamentos imobiliários', 'casas em condomínio', 'financiamento imobiliário', 'home equity'],
        sameAs: [EMPRESA.instagram]
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#site`,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${SITE_URL}/#empresa` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
          'query-input': 'required name=search_term_string'
        }
      }
    ]
  };
}

export function buildDevelopmentMetadata(development: Development): Metadata {
  const badge = getBadgeCondominio(development.deliveryDate, development.tipo);
  const onde = [development.bairro, development.cidade].filter(Boolean).join(', ') || development.location;
  const tipoTxt = development.tipo === 'horizontal' ? 'Condomínio de casas' : 'Edifício';
  const title = `${development.name} — ${tipoTxt} ${badge.label && development.tipo !== 'horizontal' ? `${badge.label.toLowerCase()} ` : ''}no ${onde}`.slice(0, 95);
  const desc =
    descricaoTextoPuro(development.description) ||
    `${development.name}, ${tipoTxt.toLowerCase()} em ${onde}. Veja imóveis à venda, fotos, lazer, plantas e valores na Mais Novos Imóveis.`;
  const description = desc.length > 158 ? `${desc.slice(0, 155).replace(/\s+\S*$/, '')}…` : desc;
  const url = `${SITE_URL}/empreendimento/${development.id}`;
  const imagem = development.photos?.[0];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'pt_BR',
      images: imagem ? [{ url: imagem, alt: `${development.name} — ${onde} | ${SITE_NAME}` }] : undefined
    },
    twitter: { card: imagem ? 'summary_large_image' : 'summary', title, description, images: imagem ? [imagem] : undefined }
  };
}

export function buildDevelopmentJsonLd(development: Development) {
  const url = `${SITE_URL}/empreendimento/${development.id}`;
  const anuncios = development.units.filter((u) => !u.isTipologia);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        // ApartmentComplex = prédio; GatedResidenceCommunity = condomínio fechado de casas
        '@type': development.tipo === 'vertical' ? 'ApartmentComplex' : 'GatedResidenceCommunity',
        '@id': `${url}#condominio`,
        name: development.name,
        description: descricaoTextoPuro(development.description) || undefined,
        url,
        image: (development.photos ?? []).slice(0, 10),
        address: {
          '@type': 'PostalAddress',
          addressLocality: development.cidade || undefined,
          addressRegion: 'GO',
          addressCountry: 'BR',
          streetAddress: development.bairro || undefined
        },
        amenityFeature: development.amenities.map((a) => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })),
        containsPlace: anuncios.slice(0, 20).map((u) => ({ '@type': TIPO_UNIDADE_SCHEMA_ORG[u.tipoUnidade], url: `${SITE_URL}/imovel/${u.id}`, name: tituloSeoImovel(u) }))
      },
      trilha([...trilhaDoImovel({ cidade: development.cidade, bairro: development.bairro }), { nome: development.name, url }])
    ]
  };
}

/** JSON dentro de <script>: escapa caracteres que poderiam fechar a tag */
export function jsonLdSeguro(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}

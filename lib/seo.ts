import type { Metadata } from 'next';
import type { PropertyDetail, Development } from './property-details';
import { getStatusBadge } from './classification';
import { TIPO_UNIDADE_LABEL, TIPO_UNIDADE_SCHEMA_ORG } from './tipologias';
import { descricaoTextoPuro } from './text';

// Trocar pelo domínio definitivo assim que ele existir — hoje aponta pro
// domínio da Vercel pra sitemap/canonical/OG funcionarem desde já.
export const SITE_URL = 'https://portal-mais-novos-imoveis.vercel.app';
export const SITE_NAME = 'Mais Novos Imóveis';

function firstDigits(text: string): string {
  const match = text.match(/\d+/);
  return match ? match[0] : '';
}

export function buildPropertyMetadata(property: PropertyDetail): Metadata {
  const badge = getStatusBadge(property.deliveryDate);
  const tipo = TIPO_UNIDADE_LABEL[property.tipoUnidade];
  const baseTitle = property.titulo || `${tipo} em ${property.location}`;
  const title = badge.label ? `${baseTitle} — ${badge.label} | ${SITE_NAME}` : `${baseTitle} | ${SITE_NAME}`;
  const description = descricaoTextoPuro(property.description).slice(0, 155);
  const url = `${SITE_URL}/imovel/${property.id}`;

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
      locale: 'pt_BR'
    },
    twitter: {
      card: 'summary',
      title,
      description
    }
  };
}

export function buildPropertyJsonLd(property: PropertyDetail) {
  const url = `${SITE_URL}/imovel/${property.id}`;
  return {
    '@context': 'https://schema.org',
    // Dois tipos juntos: "RealEstateListing" descreve o anúncio, e o segundo
    // (Apartment/SingleFamilyResidence/Place, conforme o tipo do imóvel)
    // descreve o imóvel em si — o JSON-LD aceita @type como lista.
    '@type': ['RealEstateListing', TIPO_UNIDADE_SCHEMA_ORG[property.tipoUnidade]],
    name: property.titulo || `${TIPO_UNIDADE_LABEL[property.tipoUnidade]} em ${property.location}`,
    description: descricaoTextoPuro(property.description),
    url,
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.location,
      addressCountry: 'BR'
    },
    numberOfRooms: firstDigits(property.beds) || undefined,
    floorSize: {
      '@type': 'QuantitativeValue',
      value: firstDigits(property.area) || undefined,
      unitCode: 'MTK'
    },
    offers: {
      '@type': 'Offer',
      price: property.price.replace(/[^\d,]/g, '').replace(',', '.') || undefined,
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock'
    }
  };
}

export function buildAgentJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: SITE_NAME,
    url: SITE_URL,
    areaServed: 'Goiânia, GO, Brasil',
    sameAs: ['https://www.instagram.com/leydeduarte.br']
  };
}

export function buildDevelopmentMetadata(development: Development): Metadata {
  const badge = getStatusBadge(development.deliveryDate);
  const title = `${development.name} — ${development.location}${badge.label ? ` | ${badge.label}` : ''} | ${SITE_NAME}`;
  const description = (descricaoTextoPuro(development.description) || `${development.name} em ${development.location}.`).slice(0, 155);
  const url = `${SITE_URL}/empreendimento/${development.id}`;

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
      locale: 'pt_BR'
    },
    twitter: {
      card: 'summary',
      title,
      description
    }
  };
}

export function buildDevelopmentJsonLd(development: Development) {
  const url = `${SITE_URL}/empreendimento/${development.id}`;
  return {
    '@context': 'https://schema.org',
    // ApartmentComplex pra condomínio vertical (prédio), GatedResidenceCommunity
    // pra horizontal (loteamento fechado de casas) — os dois são tipos
    // específicos do schema.org pra isso, mais precisos que um "Residence" genérico.
    '@type': development.tipo === 'vertical' ? 'ApartmentComplex' : 'GatedResidenceCommunity',
    name: development.name,
    description: descricaoTextoPuro(development.description) || undefined,
    url,
    address: {
      '@type': 'PostalAddress',
      addressLocality: development.location,
      addressCountry: 'BR'
    },
    amenityFeature: development.amenities.map((a) => ({
      '@type': 'LocationFeatureSpecification',
      name: a
    }))
  };
}

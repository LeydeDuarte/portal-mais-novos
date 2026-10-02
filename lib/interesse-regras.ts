// Regras do "Avise-me" por tipo de imóvel. Usado pelo formulário (site e, depois,
// mapa), pelo servidor (registro e avisos) e pelo painel (textos).
//  - apartamento e casa: pergunta obrigatória = quartos (0 a 4+);
//  - comercial, lote e rural: pergunta obrigatória = tamanho (faixa de área);
//  - alcance: só no condomínio / no bairro / no município, ou um raio em metros.
//    Rural usa outra escala: município, 100 km, 300 km.
import type { TipoUnidade } from './tipologias';

export type GrupoInteresse = 'apartamento' | 'casa' | 'comercial' | 'lote' | 'rural';

export const GRUPO_LABEL: Record<GrupoInteresse, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  comercial: 'Comercial',
  lote: 'Lote',
  rural: 'Rural'
};

export const GRUPO_DO_TIPO: Record<TipoUnidade, GrupoInteresse> = {
  studio: 'apartamento',
  flat: 'apartamento',
  loft: 'apartamento',
  apartamento: 'apartamento',
  apartamento_garden: 'apartamento',
  apartamento_duplex: 'apartamento',
  apartamento_triplex: 'apartamento',
  cobertura: 'apartamento',
  cobertura_duplex: 'apartamento',
  penthouse: 'apartamento',
  casa: 'casa',
  casa_condominio: 'casa',
  sobrado: 'casa',
  terreno_lote: 'lote',
  chacara_sitio_fazenda: 'rural',
  sala_comercial: 'comercial',
  loja_ponto_comercial: 'comercial',
  galpao: 'comercial',
  predio_comercial: 'comercial'
};

/** tipos de cada grupo (para a consulta no banco) */
export const TIPOS_DO_GRUPO: Record<GrupoInteresse, TipoUnidade[]> = (Object.keys(GRUPO_DO_TIPO) as TipoUnidade[]).reduce(
  (acc, t) => {
    acc[GRUPO_DO_TIPO[t]].push(t);
    return acc;
  },
  { apartamento: [], casa: [], comercial: [], lote: [], rural: [] } as Record<GrupoInteresse, TipoUnidade[]>
);

export const grupoUsaQuartos = (g: GrupoInteresse) => g === 'apartamento' || g === 'casa';

/** faixas de tamanho (m²) para comercial, lote e rural; rural aparece em hectares */
export const FAIXAS_AREA: Record<'comercial' | 'lote' | 'rural', { rotulo: string; min: number | null; max: number | null }[]> = {
  comercial: [
    { rotulo: 'Até 50 m²', min: null, max: 50 },
    { rotulo: '50 a 150 m²', min: 50, max: 150 },
    { rotulo: '150 a 500 m²', min: 150, max: 500 },
    { rotulo: '500 m² ou mais', min: 500, max: null }
  ],
  lote: [
    { rotulo: 'Até 360 m²', min: null, max: 360 },
    { rotulo: '360 a 600 m²', min: 360, max: 600 },
    { rotulo: '600 a 1.000 m²', min: 600, max: 1000 },
    { rotulo: '1.000 m² ou mais', min: 1000, max: null }
  ],
  rural: [
    { rotulo: 'Até 2 ha', min: null, max: 20000 },
    { rotulo: '2 a 10 ha', min: 20000, max: 100000 },
    { rotulo: '10 a 50 ha', min: 100000, max: 500000 },
    { rotulo: '50 ha ou mais', min: 500000, max: null }
  ]
};

// Alcance: 0 = só no condomínio; -1 = só no bairro; -2 = só no município; >0 = metros
export const RAIO_CONDOMINIO = 0;
export const RAIO_BAIRRO = -1;
export const RAIO_MUNICIPIO = -2;
export const RAIOS_VALIDOS = [RAIO_CONDOMINIO, RAIO_BAIRRO, RAIO_MUNICIPIO, 500, 2000, 100000, 300000];

export function opcoesDeAlcance(grupo: GrupoInteresse, ref: { condominio?: string | null; bairro?: string | null; cidade?: string | null }): [number, string][] {
  const curto = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);
  if (grupo === 'rural')
    return [
      [RAIO_MUNICIPIO, ref.cidade ? `Só em ${curto(ref.cidade)}` : 'Só no município'],
      [100000, 'Até 100 km'],
      [300000, 'Até 300 km']
    ];
  const primeira: [number, string][] = ref.condominio
    ? [[RAIO_CONDOMINIO, `Só no ${curto(ref.condominio)}`]]
    : ref.bairro
      ? [[RAIO_BAIRRO, `Só no ${curto(ref.bairro)}`]]
      : [];
  return [...primeira, [500, 'Até 500 m'], [2000, 'Até 2 km']];
}

/** texto do alcance para o painel e para o e-mail da equipe */
export function textoAlcance(raio: number, ref: { condominio?: string | null; bairro?: string | null; cidade?: string | null }): string {
  const de = ref.condominio ? ` do ${ref.condominio}` : ref.bairro ? ` do ${ref.bairro}` : '';
  if (raio === RAIO_CONDOMINIO) return `só no ${ref.condominio ?? 'condomínio'}`;
  if (raio === RAIO_BAIRRO) return `só no ${ref.bairro ?? 'bairro'}`;
  if (raio === RAIO_MUNICIPIO) return `só em ${ref.cidade ?? 'no município'}`;
  if (raio >= 1000) return `até ${(raio / 1000).toLocaleString('pt-BR')} km${de}`;
  return `até ${raio} m${de}`;
}

/** texto da faixa de área ("50 a 150 m²", "2 a 10 ha") */
export function textoArea(grupo: string | null, min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const ha = grupo === 'rural';
  const f = (v: number) => (ha ? `${(v / 10000).toLocaleString('pt-BR')} ha` : `${v.toLocaleString('pt-BR')} m²`);
  if (min != null && max != null) return `${f(min).replace(/ (m²|ha)$/, '')} a ${f(max)}`;
  if (max != null) return `até ${f(max)}`;
  return `${f(min!)} ou mais`;
}

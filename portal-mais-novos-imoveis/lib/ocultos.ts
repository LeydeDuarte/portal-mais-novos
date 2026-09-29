import type { AnuncioOculto } from './actions';
import { TIPO_UNIDADE_LABEL } from './tipologias';

export function brlCurto(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** "Apartamento de 3 quartos, 130 m² no Setor Marista" */
export function tituloOculto(a: AnuncioOculto): string {
  const partes = [TIPO_UNIDADE_LABEL[a.tipoUnidade]];
  const det = [a.quartos ? `${a.quartos} ${a.quartos === 1 ? 'quarto' : 'quartos'}` : null, a.area ? `${Math.round(a.area)} m²` : null].filter(Boolean).join(', ');
  return `${partes[0]}${det ? ` de ${det}` : ''}${a.bairro ? ` no ${a.bairro}` : ''}${a.cidade ? `, ${a.cidade}` : ''}`;
}

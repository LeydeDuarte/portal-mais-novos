// Posição usada na "Posição do sol" da página do anúncio (módulo do servidor).
// Anúncio em condomínio: a posição do condomínio (já é pública).
// Anúncio de rua (casa, loja, lote): posição ARREDONDADA para ~1 km, para não
// revelar o endereço no código da página. Para o cálculo do sol, 1 km não muda
// nada que se perceba (diferença de segundos no nascer e no pôr).
import { query } from './db';

export async function posicaoParaSol(propertyId: string): Promise<{ lat: number; lng: number; aproximado: boolean } | null> {
  const r = await query<{ d_lat: number | null; d_lng: number | null; lat: number | null; lng: number | null }>(
    `select d.lat as d_lat, d.lng as d_lng, p.lat, p.lng
       from properties p left join developments d on d.id = p.empreendimento_id
      where p.id = $1`,
    [propertyId]
  ).catch(() => []);
  const x = r[0];
  if (!x) return null;
  if (x.d_lat != null && x.d_lng != null) return { lat: Number(x.d_lat), lng: Number(x.d_lng), aproximado: false };
  if (x.lat != null && x.lng != null) return { lat: Math.round(Number(x.lat) * 100) / 100, lng: Math.round(Number(x.lng) * 100) / 100, aproximado: true };
  return null;
}

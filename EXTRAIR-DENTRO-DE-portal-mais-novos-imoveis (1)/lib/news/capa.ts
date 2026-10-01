// Capa da notícia em WebP 1200×675 (16:9), o formato que o Google Discover e as
// prévias de redes sociais pedem. Gerada a partir da foto de capa enviada, com corte
// inteligente (mantém a parte mais importante da imagem) e guardada no R2.
import sharp from 'sharp';
import { query } from '../db';
import { enviarParaR2, r2Configurado } from '../r2';

export async function gerarCapa16x9(noticiaId: string): Promise<string | null> {
  const r = await query<{ capa: string | null; slug: string }>('select capa, slug from noticias where id = $1', [noticiaId]);
  const n = r[0];
  if (!n?.capa || r2Configurado().length) return null;
  try {
    const res = await fetch(n.capa, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const original = Buffer.from(await res.arrayBuffer());
    const webp = await sharp(original, { failOn: 'none', limitInputPixels: 400_000_000 })
      .rotate()
      .resize(1200, 675, { fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 80 })
      .toBuffer();
    const url = await enviarParaR2(webp, 'image/webp', 'noticias', `${n.slug}-capa-1200x675`);
    await query('update noticias set capa_16x9 = $2 where id = $1', [noticiaId, url]);
    return url;
  } catch {
    return null;
  }
}

/** Gera as capas 16:9 que faltam (painel → News) */
export async function gerarCapasPendentes(limite = 20): Promise<number> {
  const rows = await query<{ id: string }>(`select id from noticias where capa is not null and (capa_16x9 is null or capa_16x9 = '') limit $1`, [limite]);
  let feitas = 0;
  for (const r of rows) if (await gerarCapa16x9(r.id)) feitas++;
  return feitas;
}

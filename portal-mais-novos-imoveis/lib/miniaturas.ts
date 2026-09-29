// Miniaturas das capas (feed rápido): em vez de baixar a foto original (1–4 MB)
// em cada card, o feed usa uma versão WebP de 640 px (~40–70 KB) guardada no R2.
// - capa_mini    = endereço da miniatura
// - capa_mini_de = de qual foto ela foi feita (se a capa mudar, refaz sozinho)
import sharp from 'sharp';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { query } from './db';
import { r2PublicBase } from './r2-url';

const LARGURA = 640;
let client: S3Client | null = null;
function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID || '', secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '' }
    });
  }
  return client;
}

/** Baixa a foto, reduz para 640 px WebP e grava ao lado da original (pasta mini/). */
export async function criarMiniatura(url: string): Promise<string | null> {
  const base = r2PublicBase();
  if (!base || !/^https:\/\//.test(url)) return null;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  const tipo = (r.headers.get('content-type') ?? '').split(';')[0];
  if (!/^image\//.test(tipo)) return null;
  const original = Buffer.from(await r.arrayBuffer());
  if (original.length > 25 * 1024 * 1024) return null;
  const webp = await sharp(original, { failOn: 'none' }).rotate().resize({ width: LARGURA, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
  // mesmo nome da original (bom para SEO de imagem), na pasta mini/
  const caminho = url.startsWith(base) ? url.slice(base.length + 1) : `externas/${url.replace(/^https:\/\//, '').replace(/[^\w./-]/g, '-')}`;
  const key = `mini/${caminho.replace(/\.(jpe?g|png|webp|gif)$/i, '')}.w${LARGURA}.webp`.slice(0, 900);
  await r2().send(
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: webp, ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable' })
  );
  return `${base}/${key}`;
}

/** Gera as miniaturas que faltam (capas novas ou trocadas), aos poucos. */
export async function processarMiniaturas(orcamentoMs = 20000): Promise<{ feitas: number; restantes: number; erros: string[] }> {
  const fim = Date.now() + orcamentoMs;
  const erros: string[] = [];
  let feitas = 0;
  for (const tabela of ['properties', 'developments'] as const) {
    const filtro = tabela === 'properties' ? "and visibilidade = 'publico'" : "and status = 'publicado'";
    const linhas = await query<{ id: string; capa: string }>(
      `select id, photos->>0 as capa from ${tabela}
        where jsonb_array_length(coalesce(photos, '[]'::jsonb)) > 0 and capa_mini_de is distinct from photos->>0 ${filtro}
        order by created_at desc limit 40`
    );
    for (const l of linhas) {
      if (Date.now() > fim) break;
      try {
        const mini = await criarMiniatura(l.capa);
        // sem miniatura possível: marca assim mesmo (o card usa a original) para não tentar de novo
        await query(`update ${tabela} set capa_mini = $2, capa_mini_de = $3 where id = $1`, [l.id, mini, l.capa]);
        if (mini) feitas++;
      } catch (e) {
        erros.push(`${l.id}: ${e instanceof Error ? e.message.slice(0, 80) : 'falha'}`);
        await query(`update ${tabela} set capa_mini = null, capa_mini_de = $2 where id = $1`, [l.id, l.capa]).catch(() => {});
      }
    }
  }
  const rest = await query<{ n: string }>(
    `select (select count(*) from properties where visibilidade = 'publico' and jsonb_array_length(coalesce(photos, '[]'::jsonb)) > 0 and capa_mini_de is distinct from photos->>0)
          + (select count(*) from developments where status = 'publicado' and jsonb_array_length(coalesce(photos, '[]'::jsonb)) > 0 and capa_mini_de is distinct from photos->>0) as n`
  );
  return { feitas, restantes: Number(rest[0]?.n) || 0, erros: erros.slice(0, 5) };
}

/** Miniatura de um anúncio/condomínio logo depois de salvar (sem travar o salvamento). */
export async function miniaturaDe(tabela: 'properties' | 'developments', id: string): Promise<void> {
  const r = await query<{ capa: string | null; de: string | null }>(`select photos->>0 as capa, capa_mini_de as de from ${tabela} where id = $1`, [id]);
  const capa = r[0]?.capa;
  if (!capa || capa === r[0]?.de) return;
  const mini = await criarMiniatura(capa).catch(() => null);
  await query(`update ${tabela} set capa_mini = $2, capa_mini_de = $3 where id = $1`, [id, mini, capa]);
}

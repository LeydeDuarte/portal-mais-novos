import crypto from 'crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { r2PublicBase } from './r2-url';

// Envio de arquivos para o Cloudflare R2 (servidor). Usado pelo upload do
// painel e pela importação da Jetimob (que baixa as fotos e guarda aqui).
let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID || '', secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '' }
    });
  }
  return client;
}

export function r2Configurado(): string[] {
  return ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'].filter((k) => !process.env[k]);
}

export function slugArquivo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/²/g, '2')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

/** Grava e devolve a URL pública. Nome: <pasta>/<ano>/<mês>/<nome>-mais-novos-imoveis-<8>.ext */
export async function enviarParaR2(body: Buffer, contentType: string, folder: string, nome: string): Promise<string> {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const now = new Date();
  const slug = slugArquivo(nome) || (folder === 'plantas' ? 'planta' : 'imovel');
  const key = `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${slug}-mais-novos-imoveis-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await getClient().send(
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' })
  );
  return `${r2PublicBase()}/${key}`;
}

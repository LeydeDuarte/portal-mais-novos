import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { verifySession } from '@/lib/session';
import { r2PublicBase } from '@/lib/r2-url';

// Upload de fotos para o Cloudflare R2 (bucket `portal-mais-novos-imoveis-fotos`).
// Só a equipe logada pode enviar. O navegador já reduz a foto antes de mandar
// (máx. 2000px, JPEG) — ver components/PhotoUploadField.tsx —, então cada
// envio fica bem abaixo do limite de 4,5 MB por requisição da Vercel.
export const runtime = 'nodejs';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FOLDERS = new Set(['imoveis', 'empreendimentos']);

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
      }
    });
  }
  return client;
}

export async function POST(request: Request) {
  const staff = verifySession(cookies().get('mn_staff')?.value);
  if (!staff) return NextResponse.json({ error: 'Faça login no painel para enviar fotos.' }, { status: 401 });

  const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    return NextResponse.json({ error: `Armazenamento de fotos não configurado (faltando: ${missing.join(', ')}).` }, { status: 500 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const folderRaw = String(form.get('folder') || 'imoveis');
  const folder = FOLDERS.has(folderRaw) ? folderRaw : 'imoveis';

  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Nenhuma foto recebida.' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Formato não aceito — use JPG, PNG ou WEBP.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Foto muito grande (máx. 4 MB).' }, { status: 400 });

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const now = new Date();
  const key = `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000, immutable'
      })
    );
  } catch (err) {
    console.error('Falha no upload para o R2', err);
    return NextResponse.json({ error: 'Não foi possível salvar a foto agora. Tente novamente.' }, { status: 502 });
  }

  return NextResponse.json({ url: `${r2PublicBase()}/${key}` });
}

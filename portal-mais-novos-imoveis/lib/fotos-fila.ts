import sharp from 'sharp';

// Prepara uma foto baixada pela fila (Jetimob, Google Drive, sites de
// incorporadoras) antes de ir para o R2. Fotos grandes (acima de 2 MB ou
// mais largas que o limite) são reduzidas e comprimidas em JPEG; as pequenas
// seguem como vieram. Aceita arquivos de até 150 MB na origem (fotos originais de incorporadora).
export const MAX_ORIGEM_BYTES = 150 * 1024 * 1024;
const MAX_FINAL_BYTES = 2 * 1024 * 1024;

export async function prepararFoto(
  buf: Buffer,
  tipoOrigem: string,
  ehPlanta = false
): Promise<{ buf: Buffer; tipo: string }> {
  if (buf.length > MAX_ORIGEM_BYTES) throw new Error('foto maior que 150 MB');
  let meta: sharp.Metadata;
  try {
    meta = await sharp(buf, { failOn: 'none', limitInputPixels: 400_000_000 }).metadata();
  } catch {
    throw new Error('arquivo não é imagem (HEIC do iPhone não é aceito: use JPG)');
  }
  const formato = meta.format === 'jpeg' ? 'image/jpeg' : meta.format === 'png' ? 'image/png' : meta.format === 'webp' ? 'image/webp' : '';
  const largura = Math.max(meta.width ?? 0, meta.height ?? 0);
  const limite = ehPlanta ? 3000 : 2400;
  if (formato && buf.length <= MAX_FINAL_BYTES && largura <= limite) {
    return { buf, tipo: formato || tipoOrigem };
  }
  const saida = await sharp(buf, { failOn: 'none', limitInputPixels: 400_000_000 })
    .rotate()
    .resize({ width: limite, height: limite, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: ehPlanta ? 88 : 82, mozjpeg: true })
    .toBuffer();
  return { buf: saida, tipo: 'image/jpeg' };
}

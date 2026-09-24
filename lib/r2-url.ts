// Endereço público das fotos no R2 (variável R2_PUBLIC_URL na Vercel).
// Tolerante a "sujeira" de copiar e colar — ex: se o valor vier como
// "[https://pub-xxx.r2.dev](https://pub-xxx.r2.dev)" (formato de link de chat),
// ou sem o https://, ou com barra no final, extrai só o endereço limpo.
export function r2PublicBase(): string {
  const raw = (process.env.R2_PUBLIC_URL || '').trim();
  const match = raw.match(/https?:\/\/[^\s\[\]()<>"']+/);
  const url = match ? match[0] : raw.replace(/[\s\[\]()<>"']/g, '');
  if (!url) return '';
  const withProto = /^https?:\/\//.test(url) ? url : `https://${url}`;
  return withProto.replace(/^http:\/\//, 'https://').replace(/\/+$/, '');
}

// Conserta URLs de foto que já foram salvas com o endereço "sujo"
// (ex: "https://[https://pub-xxx.r2.dev](https://pub-xxx.r2.dev)/imoveis/a.jpg").
export function cleanPhotoUrl(url: string): string {
  const broken = url.match(/^https?:\/\/\[(https?:\/\/[^\]]+)\]\([^)]*\)(\/.*)$/);
  return broken ? `${broken[1].replace(/\/+$/, '')}${broken[2]}` : url;
}

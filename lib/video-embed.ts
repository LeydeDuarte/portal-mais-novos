// Reconhece um link de YouTube ou Instagram e devolve a URL de embed pronta
// pra tocar direto na capa do imóvel/empreendimento — sem precisar de script
// externo (o /embed do Instagram e o /embed do YouTube funcionam sozinhos
// num <iframe>).

export type EmbedInfo = { platform: 'youtube' | 'instagram'; embedUrl: string };

export function getEmbedInfo(url: string): EmbedInfo | null {
  if (!url) return null;

  // aceita youtube.com/watch?v=, youtu.be/, youtube.com/shorts/ e já vindo como /embed/
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) {
    const id = yt[1];
    return {
      platform: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&playsinline=1`
    };
  }

  // aceita instagram.com/reel/CODIGO ou /p/CODIGO ou /tv/CODIGO, com ou sem barra final
  const ig = url.match(/instagram\.com\/(reel|p|tv)\/([a-zA-Z0-9_-]+)/);
  if (ig) {
    return { platform: 'instagram', embedUrl: `https://www.instagram.com/${ig[1]}/${ig[2]}/embed` };
  }

  return null;
}

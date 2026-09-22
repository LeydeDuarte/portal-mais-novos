// Reconhece um link de YouTube ou Instagram e devolve a URL de embed pronta
// pra tocar direto na capa do imóvel/empreendimento — sem precisar de script
// externo (o /embed do Instagram e o /embed do YouTube funcionam sozinhos
// num <iframe>).

export type EmbedInfo =
  | { platform: 'youtube'; embedUrl: string; videoId: string }
  | { platform: 'instagram'; embedUrl: string };

export function getEmbedInfo(url: string): EmbedInfo | null {
  if (!url) return null;

  // aceita youtube.com/watch?v=, youtu.be/, youtube.com/shorts/ e já vindo como /embed/
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) {
    const id = yt[1];
    return {
      platform: 'youtube',
      videoId: id,
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

// Consulta o formato real do vídeo (largura/altura) direto na API pública do
// YouTube (oEmbed) — assim descobrimos se o vídeo é horizontal (16:9) ou
// vertical (gravado no celular, formato Reels/Shorts) sem precisar adivinhar,
// e o quadro na página do imóvel se ajusta certo pros dois casos, sem cortar
// nada nem sobrar tarja preta.
export async function getYouTubeAspectRatio(videoId: string): Promise<{ width: number; height: number } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      next: { revalidate: 60 * 60 * 24 } // o formato do vídeo não muda; cacheia por 1 dia
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { width?: number; height?: number };
    if (!data.width || !data.height) return null;
    return { width: data.width, height: data.height };
  } catch {
    return null;
  }
}

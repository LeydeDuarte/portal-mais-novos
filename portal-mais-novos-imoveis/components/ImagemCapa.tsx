'use client';

import { useState } from 'react';

// Capa do card: usa a miniatura leve (WebP 640 px) e, se ela falhar, a foto original.
// As primeiras fotos da tela carregam com prioridade; o resto só quando chega perto.
export default function ImagemCapa({
  mini,
  original,
  alt,
  prioridade = false,
  className = ''
}: {
  mini?: string;
  original: string;
  alt: string;
  prioridade?: boolean;
  className?: string;
}) {
  const [src, setSrc] = useState(mini || original);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={prioridade ? 'eager' : 'lazy'}
      decoding="async"
      // eslint-disable-next-line react/no-unknown-property
      fetchPriority={prioridade ? 'high' : 'auto'}
      onError={() => src !== original && setSrc(original)}
      className={className}
      draggable={false}
    />
  );
}

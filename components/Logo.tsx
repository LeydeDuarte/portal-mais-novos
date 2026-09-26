// Logomarca Mais Novos: versão escura (letras pretas) no fundo claro e versão
// branca quando o aparelho está em modo escuro. "completo" = /mais novos;
// "simbolo" = /mn (celular).
const ARQ = {
  completo: { claro: '/marca/logotipo-preto', escuro: '/marca/logotipo-branco', w: 262, h: 120 },
  simbolo: { claro: '/marca/simbolo-logotipo-preto', escuro: '/marca/simbolo-logotipo-branco', w: 141, h: 96 }
};

export default function Logo({ tipo = 'completo', altura = 36, className = '' }: { tipo?: 'completo' | 'simbolo'; altura?: number; className?: string }) {
  const a = ARQ[tipo];
  const largura = Math.round((a.w * altura) / a.h);
  return (
    <picture className={className}>
      <source srcSet={`${a.escuro}.webp`} media="(prefers-color-scheme: dark)" type="image/webp" />
      <source srcSet={`${a.escuro}.png`} media="(prefers-color-scheme: dark)" />
      <source srcSet={`${a.claro}.webp`} type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${a.claro}.png`} alt="Mais Novos Imóveis" width={largura} height={altura} style={{ height: altura, width: 'auto' }} className="block" />
    </picture>
  );
}

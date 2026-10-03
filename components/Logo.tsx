// Logomarca Mais Novos: versão escura (letras pretas) no fundo claro e versão
// branca quando o aparelho está em modo escuro. "completo" = /mais novos;
// "simbolo" = /mn (celular).
const ARQ = {
  completo: { claro: '/marca/logotipo-preto', escuro: '/marca/logotipo-branco', w: 262, h: 120 },
  simbolo: { claro: '/marca/simbolo-logotipo-preto', escuro: '/marca/simbolo-logotipo-branco', w: 141, h: 96 }
};

export default function Logo({ tipo = 'completo', altura = 36, className = '', cor = 'auto' }: { tipo?: 'completo' | 'simbolo'; altura?: number; className?: string; cor?: 'auto' | 'branco' }) {
  const a = ARQ[tipo];
  if (cor === 'branco') {
    // fundo escuro fixo (ex.: céu da noite no login): sempre a versão branca
    const larguraB = Math.round((a.w * altura) / a.h);
    return (
      <picture className={className}>
        <source srcSet={`${a.escuro}.webp`} type="image/webp" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${a.escuro}.png`} alt="Mais Novos Imóveis" width={larguraB} height={altura} style={{ height: altura, width: 'auto' }} className="block" />
      </picture>
    );
  }
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

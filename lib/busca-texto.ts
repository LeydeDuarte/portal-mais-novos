// Texto para comparar nas buscas do painel: sem acento e sem maiúsculas, e com as grafias
// que costumam variar nos nomes de condomínios, bairros e construtoras tratadas como iguais:
// y = i (Ypê/Ipê), w = v (Wilson/Vilson), ph = f, th = t, letras dobradas = simples (Villa/Vila).
// Aplicada dos DOIS lados (no que se digita e no nome cadastrado).
export function paraBusca(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/y/g, 'i')
    .replace(/w/g, 'v')
    .replace(/([a-z])\1+/g, '$1');
}

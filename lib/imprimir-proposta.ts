/** Imprime só o documento da proposta (o resto da página some na impressão). */
export function imprimirProposta() {
  document.body.classList.add('imprimindo-proposta');
  const tirar = () => document.body.classList.remove('imprimindo-proposta');
  window.addEventListener('afterprint', tirar, { once: true });
  window.print();
  setTimeout(tirar, 1500);
}

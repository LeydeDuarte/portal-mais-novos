/** Imprime/salva em PDF só o documento da proposta, com o nome do arquivo certo. */
export function imprimirProposta(nomeArquivo?: string) {
  const tituloAntes = document.title;
  if (nomeArquivo) document.title = nomeArquivo; // o Chrome usa o título como nome do PDF
  document.body.classList.add('imprimindo-proposta');
  const tirar = () => {
    document.body.classList.remove('imprimindo-proposta');
    document.title = tituloAntes;
  };
  window.addEventListener('afterprint', tirar, { once: true });
  window.print();
  setTimeout(tirar, 1500);
}

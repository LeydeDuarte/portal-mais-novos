// Formatação de documentos e telefones para exibir no painel
export function formatarDocumento(d?: string | null): string {
  const n = (d ?? '').replace(/\D/g, '');
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return n;
}
export function formatarTelefone(d?: string | null): string {
  let n = (d ?? '').replace(/\D/g, '');
  if (n.length > 11 && n.startsWith('55')) n = n.slice(2);
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return n;
}

// Endereços amigáveis (SEO): o nome do imóvel/condomínio na URL, em vez do código.
//   /imovel/apartamento-3-quartos-a-venda-residencial-demoiselle-goiania
//   /empreendimento/visage-arena-goiania
// O "slug" é criado no banco (gatilho) e não muda depois. Os endereços antigos com
// o código continuam funcionando e redirecionam (301) para o novo.
type ComSlug = { id: string; slug?: string | null };
export const urlImovel = (p: ComSlug) => `/imovel/${p.slug || p.id}`;
export const urlCondominio = (d: ComSlug) => `/empreendimento/${d.slug || d.id}`;

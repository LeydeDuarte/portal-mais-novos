// Endereços amigáveis (SEO e confiança do cliente): tipo de negócio, estado,
// cidade, bairro e o nome do anúncio ou do empreendimento, tudo em minúsculas:
//   /imovel/a-venda/go/goiania/setor-bueno/apartamento-3-quartos-a-venda-residencial-demoiselle-goiania
//   /empreendimento/go/goiania/setor-marista/marista-262
// O último pedaço é o "slug" (criado no banco, não muda). Endereços antigos
// (/imovel/<slug>, /imovel/<código>) continuam funcionando e redirecionam (301).
type ComSlug = { id: string; slug?: string | null };
type ComLocal = { uf?: string | null; cidade?: string | null; bairro?: string | null };

/** Pedaço de URL: sem acento, minúsculo, com hífen (ex.: "Setor Bueno" → "setor-bueno") */
export const trechoUrl = (s: string | null | undefined): string =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const local = (l: ComLocal): string | null => {
  const uf = trechoUrl(l.uf || 'GO');
  const cidade = trechoUrl(l.cidade);
  const bairro = trechoUrl(l.bairro);
  return cidade && bairro ? `${uf}/${cidade}/${bairro}` : null;
};

export const urlImovel = (p: ComSlug & ComLocal & { finalidade?: string | null }) => {
  const fim = p.slug || p.id;
  const l = local(p);
  return l ? `/imovel/${p.finalidade === 'aluguel' ? 'para-alugar' : 'a-venda'}/${l}/${fim}` : `/imovel/${fim}`;
};

export const urlCondominio = (d: ComSlug & ComLocal) => {
  const fim = d.slug || d.id;
  const l = local(d);
  return l ? `/empreendimento/${l}/${fim}` : `/empreendimento/${fim}`;
};

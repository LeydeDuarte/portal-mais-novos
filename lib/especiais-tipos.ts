// Cards especiais do feed: DEPOIMENTO de cliente e DESTAQUE (propaganda própria).
export type DepoimentoCard = {
  id: string;
  nome: string;
  subtitulo: string | null; // ex.: "Comprou um apartamento no Setor Bueno"
  texto: string;
  foto: string | null;
  nota: number | null; // 1 a 5 estrelas (opcional)
};

export type DestaqueCard = {
  id: string;
  selo: string; // etiqueta pequena (padrão "Publi")
  titulo: string;
  texto: string | null;
  imagem: string | null;
  link: string | null;
  botao: string | null;
  colunas: 1 | 2 | 3; // 1 coluna, 2 colunas, ou 3 = 2 colunas e 2 linhas (grande)
  videoUrl: string | null; // vídeo em autoplay (sem som) no lugar da imagem
};

export type Depoimento = DepoimentoCard & { ativo: boolean; ordem: number; criadoEm: string };
export type Destaque = DestaqueCard & { ativo: boolean; ordem: number; inicio: string | null; fim: string | null; cliques: number; exibicoes: number; criadoEm: string };

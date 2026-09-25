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
  selo: string; // texto da barrinha (padrão "Destaque")
  titulo: string;
  texto: string | null;
  imagem: string | null;
  link: string | null;
  botao: string | null;
};

export type Depoimento = DepoimentoCard & { ativo: boolean; ordem: number; criadoEm: string };
export type Destaque = DestaqueCard & { ativo: boolean; ordem: number; inicio: string | null; fim: string | null; cliques: number; exibicoes: number; criadoEm: string };

// Frase do dia do painel e do login. Troca uma vez por dia (fuso de Goiânia/Brasília),
// sempre na mesma ordem, então todos da equipe veem a mesma frase no mesmo dia.
// Só citações curtas e conhecidas, com o autor; nada de letra de música.
// Textos sem travessões (regra do site).

export type Frase = { texto: string; autor: string; obra?: string };

export const FRASES: Frase[] = [
  { texto: 'O que a vida quer da gente é coragem.', autor: 'Guimarães Rosa', obra: 'Grande sertão: veredas' },
  { texto: 'Feliz aquele que transfere o que sabe e aprende o que ensina.', autor: 'Cora Coralina' },
  { texto: 'A vida é como andar de bicicleta: para manter o equilíbrio, é preciso continuar em movimento.', autor: 'Albert Einstein' },
  { texto: 'O otimista é um tolo. O pessimista, um chato. Bom mesmo é ser um realista esperançoso.', autor: 'Ariano Suassuna' },
  { texto: 'Sozinhos podemos fazer tão pouco; juntos podemos fazer muito.', autor: 'Helen Keller' },
  { texto: 'Tudo vale a pena se a alma não é pequena.', autor: 'Fernando Pessoa', obra: 'Mensagem' },
  { texto: 'A única maneira de fazer um excelente trabalho é amar o que você faz.', autor: 'Steve Jobs' },
  { texto: 'Aprendi que a coragem não é a ausência do medo, mas o triunfo sobre ele.', autor: 'Nelson Mandela' },
  { texto: 'Ostra feliz não faz pérola.', autor: 'Rubem Alves' },
  { texto: 'Grandes coisas não são feitas por impulso, mas por uma série de pequenas coisas reunidas.', autor: 'Vincent van Gogh' },
  { texto: 'Se você quer ser bem-sucedido, precisa ter dedicação total, buscar seu último limite e dar o melhor de si.', autor: 'Ayrton Senna' },
  { texto: 'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.', autor: 'Sêneca' },
  { texto: 'A vida só é possível reinventada.', autor: 'Cecília Meireles' },
  { texto: 'Quanto mais você celebra a sua vida, mais há na vida para celebrar.', autor: 'Oprah Winfrey' },
  { texto: 'Não basta saber, é preciso também aplicar. Não basta querer, é preciso também fazer.', autor: 'Goethe' },
  { texto: 'É preciso ter esperança, mas ter esperança do verbo esperançar.', autor: 'Paulo Freire' },
  { texto: 'O sucesso não é um acidente. É trabalho duro, perseverança, aprendizado, estudo, sacrifício e, acima de tudo, amor pelo que você está fazendo.', autor: 'Pelé' },
  { texto: 'Só se vê bem com o coração. O essencial é invisível aos olhos.', autor: 'Antoine de Saint-Exupéry', obra: 'O pequeno príncipe' },
  { texto: 'Se não puder voar, corra. Se não puder correr, ande. Se não puder andar, rasteje. Mas continue em frente.', autor: 'Martin Luther King Jr.' },
  { texto: 'A alegria é a prova dos nove.', autor: 'Oswald de Andrade', obra: 'Manifesto antropófago' },
  { texto: 'O que fica no caminho se torna o caminho.', autor: 'Marco Aurélio', obra: 'Meditações' },
  { texto: 'Bem feito é melhor do que bem dito.', autor: 'Benjamin Franklin' },
  { texto: 'Fracassei em tudo o que tentei na vida. Mas os fracassos são minhas vitórias. Eu detestaria estar no lugar de quem me venceu.', autor: 'Darcy Ribeiro' },
  { texto: 'Lembre-se de olhar para as estrelas, e não para os seus pés.', autor: 'Stephen Hawking' },
  { texto: 'Não é o ângulo reto que me atrai, nem a linha reta, dura, inflexível. O que me atrai é a curva livre e sensual.', autor: 'Oscar Niemeyer' },
  { texto: 'Maior que a tristeza de não haver vencido é a vergonha de não ter lutado.', autor: 'Rui Barbosa' },
  { texto: 'Nossas dúvidas são traidoras e nos fazem perder o bem que poderíamos conquistar, por medo de tentar.', autor: 'William Shakespeare', obra: 'Medida por medida' },
  { texto: 'Mestre não é quem sempre ensina, mas quem de repente aprende.', autor: 'Guimarães Rosa', obra: 'Grande sertão: veredas' },
  { texto: 'Uma jornada de mil léguas começa com um único passo.', autor: 'Lao-Tsé' },
  { texto: 'A vida é uma aventura ousada ou não é nada.', autor: 'Helen Keller' },
  { texto: 'Repetir, repetir, até ficar diferente.', autor: 'Manoel de Barros' },
  { texto: 'Faça o que puder, com o que tiver, onde estiver.', autor: 'Theodore Roosevelt' },
  { texto: 'Que ninguém se engane: só se consegue a simplicidade através de muito trabalho.', autor: 'Clarice Lispector', obra: 'A hora da estrela' },
  { texto: 'Sonhar grande ou sonhar pequeno dá o mesmo trabalho.', autor: 'Jorge Paulo Lemann' },
  { texto: 'Quem tem um porquê para viver suporta quase qualquer como.', autor: 'Friedrich Nietzsche' },
  { texto: 'Sonhar é acordar-se para dentro.', autor: 'Mario Quintana' },
  { texto: 'O prazer no trabalho aperfeiçoa a obra.', autor: 'Aristóteles' },
  { texto: 'A educação é a arma mais poderosa que você pode usar para mudar o mundo.', autor: 'Nelson Mandela' },
  { texto: 'Felicidade se acha é em horinhas de descuido.', autor: 'Guimarães Rosa', obra: 'Tutameia' },
  { texto: 'Nada na vida deve ser temido, somente compreendido.', autor: 'Marie Curie' },
  { texto: 'Sê todo em cada coisa. Põe quanto és no mínimo que fazes.', autor: 'Fernando Pessoa (Ricardo Reis)' },
  { texto: 'Eu não falhei. Apenas encontrei dez mil maneiras que não funcionam.', autor: 'Thomas Edison' },
  { texto: 'O saber a gente aprende com os mestres e os livros. A sabedoria se aprende é com a vida e com os humildes.', autor: 'Cora Coralina' },
  { texto: 'A melhor maneira de prever o futuro é inventá-lo.', autor: 'Alan Kay' },
  { texto: 'Não dá para gastar a criatividade. Quanto mais você usa, mais você tem.', autor: 'Maya Angelou' },
  { texto: 'A sorte favorece os audazes.', autor: 'Virgílio', obra: 'Eneida' },
  { texto: 'A maneira de começar é parar de falar e começar a fazer.', autor: 'Walt Disney' },
  { texto: 'Um país se faz com homens e livros.', autor: 'Monteiro Lobato' },
  { texto: 'Nossa maior glória não está em nunca cair, mas em levantar cada vez que caímos.', autor: 'Oliver Goldsmith' },
  { texto: 'Se você pensa que pode ou pensa que não pode, de qualquer forma você está certo.', autor: 'Henry Ford' },
  { texto: 'Um dia sem rir é um dia desperdiçado.', autor: 'Charles Chaplin' },
  { texto: 'Não há saber mais ou saber menos: há saberes diferentes.', autor: 'Paulo Freire' },
  { texto: 'Enquanto adiamos, a vida passa.', autor: 'Sêneca' },
  { texto: 'O otimismo é a fé que leva à realização. Nada pode ser feito sem esperança e confiança.', autor: 'Helen Keller' },
  { texto: 'Ninguém pode fazer você se sentir inferior sem o seu consentimento.', autor: 'Eleanor Roosevelt' },
  { texto: 'Nada é mais poderoso do que uma ideia cujo tempo chegou.', autor: 'Victor Hugo' },
  { texto: 'A felicidade não é algo pronto. Ela vem das suas próprias ações.', autor: 'Dalai Lama' },
  { texto: 'Viver é um rasgar-se e remendar-se.', autor: 'Guimarães Rosa', obra: 'Tutameia' },
  { texto: 'Somos o que fazemos repetidamente. A excelência, portanto, não é um ato, mas um hábito.', autor: 'Will Durant' },
  { texto: 'Recria tua vida, sempre, sempre.', autor: 'Cora Coralina' },
  { texto: 'O crédito pertence a quem está de fato na arena.', autor: 'Theodore Roosevelt' },
  { texto: 'Você não precisa ser ótimo para começar, mas precisa começar para ser ótimo.', autor: 'Zig Ziglar' },
  { texto: 'O segredo para progredir é começar.', autor: 'Mark Twain' },
  { texto: 'Por mais difícil que a vida pareça, sempre há algo que você pode fazer e em que pode ter sucesso.', autor: 'Stephen Hawking' }
];

/** Data de hoje no fuso de Brasília, como número de dias (igual no servidor e no navegador). */
function diaDeHoje(agora = new Date()): number {
  const [a, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(agora)
    .split('-')
    .map(Number);
  return Math.floor(Date.UTC(a, m - 1, d) / 86_400_000);
}

/** Frase do dia. `deslocamento` dá outra frase do mesmo dia (o login usa uma diferente do painel). */
export function fraseDoDia(deslocamento = 0, agora = new Date()): Frase {
  const n = FRASES.length;
  return FRASES[(((diaDeHoje(agora) + deslocamento) % n) + n) % n];
}

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora de Brasília. */
export function saudacao(agora = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(agora));
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
}

/** "sábado, 3 de outubro" */
export function dataPorExtenso(agora = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' }).format(agora);
}

export type FaseDoDia = 'manha' | 'tarde' | 'entardecer' | 'noite';

/** Momento do dia em Brasília, para a cena do painel e do login. */
export function faseDoDia(agora = new Date()): FaseDoDia {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(agora)) % 24;
  if (h >= 5 && h < 12) return 'manha';
  if (h >= 12 && h < 17) return 'tarde';
  if (h >= 17 && h < 18) return 'entardecer';
  return 'noite';
}

/** Saudação que combina com a cena do céu (o entardecer ainda é "Boa tarde"). */
export const SAUDACAO_DA_FASE: Record<FaseDoDia, string> = { manha: 'Bom dia', tarde: 'Boa tarde', entardecer: 'Boa tarde', noite: 'Boa noite' };

/** Cores do céu de cada momento (variáveis CSS usadas na faixa da frase e no login). */
export const CORES_DO_CEU: Record<FaseDoDia, Record<string, string>> = {
  manha: { '--ceu': '#EAF3FF', '--ceu-texto': '#14161A', '--ceu-suave': '#5F6368', '--ceu-botao': '#14161A', '--ceu-botao-texto': '#FFFFFF' },
  tarde: { '--ceu': '#DDEBFF', '--ceu-texto': '#14161A', '--ceu-suave': '#55606E', '--ceu-botao': '#14161A', '--ceu-botao-texto': '#FFFFFF' },
  entardecer: { '--ceu': '#FFEBDD', '--ceu-texto': '#1F1A17', '--ceu-suave': '#6B5D55', '--ceu-botao': '#14161A', '--ceu-botao-texto': '#FFFFFF' },
  noite: { '--ceu': '#13233F', '--ceu-texto': '#F3F5FA', '--ceu-suave': '#AEB8CC', '--ceu-botao': '#FFFFFF', '--ceu-botao-texto': '#14161A' }
};

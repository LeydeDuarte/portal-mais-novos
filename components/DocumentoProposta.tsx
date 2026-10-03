import { ESTADO_CIVIL, FORMAS_PAGAMENTO, brl, porExtenso } from '@/lib/proposta-textos';
import { EMPRESA } from '@/lib/seo';
import type { Corretor, Pessoa } from '@/lib/actions-propostas';
import CabecalhoDocumento from './CabecalhoDocumento';
import { numeroProposta } from '@/lib/proposta-textos';

export type DadosDocumento = {
  numero?: number;
  imovel: string;
  unidade?: string | null;
  compradores: Pessoa[];
  vendedores: Pessoa[];
  corretor: Corretor | null;
  valor: number;
  formas?: string[];
  entrada?: number | null;
  condicoes?: string | null;
  validadeDias: number;
  data: string; // ISO: data em que a proposta foi gerada
};

const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
function tel(v?: string) {
  let d = (v ?? '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : d;
}
function doc(d?: string) {
  const n = (d ?? '').replace(/\D/g, '');
  if (n.length === 11) return `CPF ${n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`;
  if (n.length === 14) return `CNPJ ${n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`;
  return d ? `documento ${d}` : '';
}

/** Qualificação da pessoa, em texto corrido (como em contrato) */
function qualificacao(p: Pessoa): string {
  const endereco = [p.endereco, p.bairro, [p.cidade, p.uf].filter(Boolean).join('/'), p.cep ? `CEP ${p.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}` : null]
    .filter(Boolean)
    .join(', ');
  const partes = [
    doc(p.documento),
    p.rg ? `RG ${p.rg}` : '',
    p.nascimento ? `nascido(a) em ${dataBR(p.nascimento)}` : '',
    p.estadoCivil ? (ESTADO_CIVIL[p.estadoCivil] ?? p.estadoCivil).toLowerCase() : '',
    p.profissao ?? '',
    endereco ? `com endereço em ${endereco}` : '',
    p.representante ? `neste ato representado(a) por ${p.representante}` : '',
    p.telefone ? `telefone ${tel(p.telefone)}` : '',
    p.email ? `e-mail ${p.email}` : ''
  ].filter(Boolean);
  return partes.length ? `, ${partes.join(', ')}` : '';
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataExtenso = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

/** Nome do arquivo ao salvar em PDF: "Proposta - Fulano - R$ 500.000" */
export const tituloArquivoProposta = (d: { compradores: Pessoa[]; valor: number }) =>
  `Proposta - ${d.compradores.map((c) => c.nome).join(' e ') || 'comprador'} - ${brl(d.valor)}`;

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid print:mt-3">
      <h3 className="mb-1 flex items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1B5FCC] print:text-[10px]">
        {/* a barra "/" da marca Mais Novos no lugar do traço */}
        <span aria-hidden className="text-[14px] font-extrabold leading-none text-[#257CFF] print:text-[13px]">
          /
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Pessoas({ lista, vazio }: { lista: Pessoa[]; vazio: string }) {
  if (!lista.length) return <p>{vazio}</p>;
  return (
    <div className="flex flex-col gap-2">
      {lista.map((p, i) => (
        <p key={i}>
          <strong>{p.nome}</strong>
          {qualificacao(p)}.
        </p>
      ))}
    </div>
  );
}

function Assinatura({ nome, papel, extra }: { nome: string; papel: string; extra?: string }) {
  return (
    <div className="break-inside-avoid pt-[72px] print:pt-[42px]">
      <div className="border-t border-[#14161a] pt-1.5 text-center text-[11.5px] leading-snug print:text-[10px]">
        <strong>{nome || '\u00a0'}</strong>
        <br />
        {papel}
        {extra ? (
          <>
            <br />
            {extra}
          </>
        ) : null}
      </div>
    </div>
  );
}

// Documento "Proposta de compra" para salvar em PDF ou imprimir. Uso interno da equipe.
export default function DocumentoProposta({ d }: { d: DadosDocumento }) {
  const corretorTxt = d.corretor?.nome ? `${d.corretor.nome}${d.corretor.creci ? `, CRECI ${d.corretor.creci}` : ''}` : null;
  // na folha, todas as assinaturas numa linha só (até 5 lado a lado) para caber em uma página
  const assinaturas = d.compradores.length + Math.max(1, d.vendedores.length) + 1;
  const colunasAssinatura = assinaturas <= 3 ? 'print:grid-cols-3' : assinaturas === 4 ? 'print:grid-cols-4' : 'print:grid-cols-5';
  return (
    <article className="documento-proposta mx-auto max-w-[800px] rounded-3xl border border-[var(--border)] bg-white px-10 py-9 text-[13px] leading-relaxed print:text-[11.5px] print:leading-snug text-[#14161a] shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <CabecalhoDocumento
        rotulo={`Proposta de compra${d.numero ? ` · nº ${numeroProposta(d.numero)}` : ''}`}
        titulo="Proposta de compra de imóvel"
        linha={`${EMPRESA.cidade}/${EMPRESA.uf}, ${dataExtenso(d.data)} · válida por ${d.validadeDias} dias`}
      />

      <Secao titulo={d.compradores.length > 1 ? 'Proponentes compradores' : 'Proponente comprador(a)'}>
        <Pessoas lista={d.compradores} vazio="Proponente não informado." />
      </Secao>

      <Secao titulo={d.vendedores.length > 1 ? 'Vendedores / proprietários' : 'Vendedor(a) / proprietário(a)'}>
        <Pessoas lista={d.vendedores} vazio="Proprietário(a) do imóvel descrito abaixo." />
      </Secao>

      <Secao titulo="Corretor responsável">
        <p>
          {corretorTxt ?? 'Mais Novos Imóveis'}. Intermediação: {EMPRESA.razao}, CNPJ {EMPRESA.cnpj}, {EMPRESA.creci}.
        </p>
      </Secao>

      <Secao titulo="Imóvel">
        <p>
          {d.imovel}
          {d.unidade ? `. Unidade: ${d.unidade}` : ''}.
        </p>
      </Secao>

      <Secao titulo="Valor e forma de pagamento">
        <p>
          O(a) proponente oferece pelo imóvel o valor total de <strong>{brl(d.valor)}</strong> ({porExtenso(d.valor)}), a ser pago da seguinte forma:
        </p>
        <div className="mt-2 rounded-2xl border-l-4 border-[#257CFF] bg-[#F2F7FF] px-5 py-3 print:mt-1.5 print:px-4 print:py-2">
          <div className="mb-0.5 flex items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1B5FCC] print:text-[10px]">
            <span aria-hidden className="text-[14px] font-extrabold leading-none text-[#257CFF] print:text-[13px]">
              /
            </span>
            Condições de pagamento
          </div>
          <div className="whitespace-pre-line text-[13.5px] print:text-[11.5px]">
            {d.condicoes?.trim() ||
              [d.entrada ? `Entrada / sinal de ${brl(d.entrada)}.` : null, ...(d.formas ?? []).map((f) => FORMAS_PAGAMENTO[f] ?? f)].filter(Boolean).join('\n')}
          </div>
        </div>
      </Secao>

      <Secao titulo="Condições gerais">
        <ol className="flex list-none flex-col gap-2 text-[12px] text-[#3c4043] print:gap-1 print:text-[9.5px] print:leading-[1.38]">
          <li>
            <strong>1.</strong> Esta proposta é válida por {d.validadeDias} dias a contar da emissão e não obriga o(a) vendedor(a) a aceitá-la.
          </li>
          <li>
            <strong>I.</strong> O proponente autoriza a coleta e o compartilhamento dos seus dados pessoais e documentos pelo intermediador, exclusivamente
            para análise cadastral e apresentação desta proposta ao vendedor, nos termos da lei vigente da LGPD (Lei nº 13.709/2018).
          </li>
          <li>
            <strong>II.</strong> Esta proposta constitui manifestação preliminar e depende da aceitação expressa do VENDEDOR, que poderá recusá-la ou
            apresentar contraproposta imotivadamente.
          </li>
          <li>
            <strong>III.</strong> A concessão de financiamento bancário/FGTS sujeita-se às normas do agente financeiro e órgãos de crédito. A obtenção dos
            recursos é de exclusiva responsabilidade do proponente comprador, devendo estar ciente de sua pré-aprovação para o uso de tais recursos e quitar
            o saldo com recursos próprios em caso de negativa.
          </li>
          <li>
            <strong>IV.</strong> O proponente comprador e vendedor reconhecem a efetiva prestação dos serviços de intermediação imobiliária, firmando neste
            ato o respectivo instrumento de prestação de serviços e anuindo expressamente que os honorários de corretagem integram o preço global desta
            proposta, sendo deduzidos e pagos diretamente à Empresa Intermediadora pelo vendedor ou comprador, conforme será ajustado no contrato de compra e
            venda entre as partes. O referido destaque e transferência encontram lastro legal no art. 725 do Código Civil e na tese vinculante do STJ firmada
            no REsp Repetitivo nº 1.599.511 (Tema 938), constituindo verba autônoma que, aperfeiçoado o negócio, não será objeto de restituição em caso de
            posterior a assinatura do contrato, rescisão ou arrependimento imotivado das partes.
          </li>
          <li>
            <strong>V. Assinatura eletrônica:</strong> As partes convencionam e declaram como válida, eficaz e plenamente vinculante a formalização deste
            instrumento por meio de assinatura eletrônica avançada ou qualificada (como a plataforma Gov.br, certificados ICP-Brasil ou plataformas digitais
            reconhecidas), nos termos da Lei nº 14.063/2020 e da MP nº 2.200-2/2001, renunciando a qualquer impugnação quanto à sua autenticidade e
            integridade.
          </li>
          <li>
            <strong>VI.</strong> Fica eleito o foro da Comarca de Goiânia/GO para dirimir quaisquer dúvidas decorrentes desta proposta, com renúncia a
            qualquer outro, ressalvadas as disposições do CDC.
          </li>
        </ol>
      </Secao>

      <p className="mt-6 break-inside-avoid print:mt-3">
        {EMPRESA.cidade}/{EMPRESA.uf}, {dataExtenso(d.data)}.
      </p>

      <div className={`grid grid-cols-1 gap-x-10 sm:grid-cols-2 print:gap-x-4 ${colunasAssinatura}`}>
        {d.compradores.map((c, i) => (
          <Assinatura key={`c${i}`} nome={c.nome} papel="Proponente comprador(a)" extra={doc(c.documento) || undefined} />
        ))}
        {(d.vendedores.length ? d.vendedores : [{ nome: '' } as Pessoa]).map((v, i) => (
          <Assinatura
            key={`v${i}`}
            nome={v.nome}
            papel="Vendedor(a): de acordo"
            extra={[doc(v.documento), v.representante].filter(Boolean).join(' · ') || undefined}
          />
        ))}
        <Assinatura nome={d.corretor?.nome ?? ''} papel="Corretor(a) responsável" extra={d.corretor?.creci ? `CRECI ${d.corretor.creci}` : EMPRESA.creci} />
      </div>

      <footer className="mt-10 flex items-center justify-between border-t border-[#e6e8eb] pt-3 text-[10.5px] text-[#9aa0a6] print:mt-5 print:pt-2 print:text-[9px]">
        <span>
          {EMPRESA.razao} · CNPJ {EMPRESA.cnpj} · {EMPRESA.creci}
        </span>
        <span>maisnovosimoveis.com</span>
      </footer>
    </article>
  );
}

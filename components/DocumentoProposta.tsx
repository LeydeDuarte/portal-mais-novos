import { ESTADO_CIVIL, FORMAS_PAGAMENTO, brl, porExtenso } from '@/lib/proposta-textos';
import { EMPRESA } from '@/lib/seo';
import type { Corretor, Pessoa } from '@/lib/actions-propostas';

export type DadosDocumento = {
  numero?: number;
  imovel: string;
  unidade?: string | null;
  comprador: Pessoa;
  vendedor: Pessoa | null;
  corretor: Corretor | null;
  valor: number;
  formas: string[];
  entrada?: number | null;
  condicoes?: string | null;
  validadeDias: number;
  data: string; // ISO
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

const Titulo = ({ children }: { children: React.ReactNode }) => <h3 className="mt-5 text-[11px] font-bold uppercase tracking-wider text-[#5f6368]">{children}</h3>;

function Assinatura({ nome, papel, extra }: { nome: string; papel: string; extra?: string }) {
  return (
    <div className="pt-12">
      <div className="border-t border-[#14161a] pt-1.5 text-center text-[11.5px] leading-snug">
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

// Documento "Proposta de compra" para imprimir ou salvar em PDF. Uso interno da equipe.
export default function DocumentoProposta({ d }: { d: DadosDocumento }) {
  const cidade = EMPRESA.cidade;
  return (
    <article className="documento-proposta mx-auto max-w-[780px] rounded-2xl border border-[var(--border)] bg-white p-8 text-[13px] leading-relaxed text-[#14161a] print:rounded-none print:border-0 print:p-0">
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#14161a] pb-3">
        <div>
          <div className="font-serif text-[22px] font-semibold leading-tight">Proposta de compra de imóvel</div>
          <div className="text-[11.5px] text-[#5f6368]">
            {d.numero ? `Nº ${String(d.numero).padStart(4, '0')} · ` : ''}Emitida em {dataBR(d.data)} · válida por {d.validadeDias} dias
          </div>
        </div>
        <div className="text-right text-[10.5px] leading-snug text-[#5f6368]">
          <div className="font-serif text-sm font-semibold text-[#14161a]">Mais Novos Imóveis</div>
          {EMPRESA.razao}
          <br />
          CNPJ {EMPRESA.cnpj} · {EMPRESA.creci}
        </div>
      </header>

      <Titulo>Proponente comprador(a)</Titulo>
      <p className="mt-1">
        <strong>{d.comprador.nome}</strong>
        {qualificacao(d.comprador)}.
      </p>

      <Titulo>Vendedor(a) / proprietário(a)</Titulo>
      <p className="mt-1">
        {d.vendedor ? (
          <>
            <strong>{d.vendedor.nome}</strong>
            {qualificacao(d.vendedor)}.
          </>
        ) : (
          'Proprietário(a) do imóvel descrito abaixo.'
        )}
      </p>

      <Titulo>Imóvel</Titulo>
      <p className="mt-1">
        {d.imovel}
        {d.unidade ? `. Unidade: ${d.unidade}` : ''}.
      </p>

      <Titulo>Valor e forma de pagamento</Titulo>
      <p className="mt-1">
        O(a) proponente oferece pelo imóvel o valor total de <strong>{brl(d.valor)}</strong> ({porExtenso(d.valor)}), a ser pago da seguinte forma:
      </p>
      <ul className="mt-1 list-disc pl-5">
        {d.entrada ? <li>Entrada / sinal de {brl(d.entrada)} ({porExtenso(d.entrada)})</li> : null}
        {d.formas.map((f) => (
          <li key={f}>{FORMAS_PAGAMENTO[f] ?? f}</li>
        ))}
      </ul>
      {d.condicoes && (
        <>
          <Titulo>Condições</Titulo>
          <p className="mt-1 whitespace-pre-line">{d.condicoes}</p>
        </>
      )}

      <Titulo>Disposições</Titulo>
      <p className="mt-1 text-[12px]">
        Esta proposta é válida por {d.validadeDias} dias a contar da emissão e não obriga o(a) vendedor(a) a aceitá-la. A concretização do negócio depende
        da análise da documentação do imóvel e das partes e, havendo financiamento, da aprovação do crédito. Aceita a proposta, as partes formalizarão a
        compra e venda por contrato próprio. Intermediação: Mais Novos Imóveis ({EMPRESA.creci})
        {d.corretor?.nome ? `, corretor(a) ${d.corretor.nome}${d.corretor.creci ? `, CRECI ${d.corretor.creci}` : ''}` : ''}.
      </p>

      <p className="mt-6">
        {cidade}/{EMPRESA.uf}, ______ de ______________________ de ________.
      </p>

      <div className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-3 print:grid-cols-3">
        <Assinatura nome={d.comprador.nome} papel="Proponente comprador(a)" extra={doc(d.comprador.documento)} />
        <Assinatura
          nome={d.vendedor?.nome ?? ''}
          papel="Vendedor(a): de acordo"
          extra={[doc(d.vendedor?.documento), d.vendedor?.representante].filter(Boolean).join(' · ') || undefined}
        />
        <Assinatura nome={d.corretor?.nome ?? ''} papel="Corretor(a) de imóveis" extra={d.corretor?.creci ? `CRECI ${d.corretor.creci}` : EMPRESA.creci} />
      </div>
    </article>
  );
}

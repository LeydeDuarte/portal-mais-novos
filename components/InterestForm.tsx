'use client';

// "Avise-me": registro de interesse do condomínio e do anúncio.
//  - logado com o Google: nome e e-mail já vêm preenchidos, só falta o WhatsApp;
//  - a pessoa escolhe o alcance: só neste condomínio, até 500 m ou até 2 km. É o
//    consentimento registrado (LGPD): recebe só o que está dentro do que escolheu;
//  - vira lead em Painel → Interessados (com o alcance) e, quando um imóvel entra
//    dentro do alcance, a pessoa recebe e-mail (lib/actions.ts, avisarInteressados).
import { useEffect, useState } from 'react';
import { registrarInteresse } from '@/lib/actions';
import { maskCurrencyInput } from '@/lib/currency';
import { useSession } from '@/lib/use-session';
import BotaoWhatsapp, { type WhatsappContexto } from '@/components/BotaoWhatsapp';
import { NUMEROS_FILTRO, alternarNumero, rotuloNumero } from '@/lib/filters';

type Props = {
  developmentId?: string;
  /** nome do condomínio (ou vazio, em anúncio sem condomínio) */
  condominio: string;
  /** true quando o condomínio não tem nenhum anúncio (quadro em evidência) */
  destaque?: boolean;
  /** formulário na página de um anúncio */
  propertyId?: string;
  whats?: WhatsappContexto;
};

const inputClass = 'h-12 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-[15px] outline-none focus:border-accent';

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

export default function InterestForm({ developmentId, condominio, destaque, propertyId, whats }: Props) {
  const { session } = useSession();
  const cliente = session.cliente;
  const temCondominio = !!condominio;
  const noAnuncio = !!propertyId;
  const [f, setF] = useState({
    nome: '',
    telefone: '',
    email: '',
    raio: temCondominio && !noAnuncio ? 0 : 500,
    quartosOpcoes: [] as number[],
    finalidade: 'venda' as 'venda' | 'aluguel',
    areaMin: '',
    areaMax: '',
    valorMax: '',
    mensagem: ''
  });
  const [detalhes, setDetalhes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const n = (s: string) => (s ? Number(s.replace(/\D/g, '')) || undefined : undefined);

  // login do Google: preenche nome e e-mail (sem apagar o que a pessoa já digitou)
  useEffect(() => {
    if (!cliente) return;
    setF((p) => ({ ...p, nome: p.nome || cliente.nome || '', email: p.email || cliente.email || '' }));
  }, [cliente]);

  const curto = condominio.length > 22 ? `${condominio.slice(0, 21)}…` : condominio;
  const opcoes: [number, string][] = [
    ...(temCondominio ? ([[0, `Só no ${curto}`]] as [number, string][]) : []),
    [500, 'Até 500 m'],
    [2000, 'Até 2 km']
  ];
  const ref = temCondominio ? ` do ${condominio}` : ' daqui';
  const alcance = f.raio === 0 ? `no ${condominio}` : f.raio === 500 ? `a até 500 m${ref}` : `a até 2 km${ref}`;

  const [faltaQuartos, setFaltaQuartos] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    // obrigatório: quantos quartos a pessoa procura (é o que filtra os avisos)
    if (!f.quartosOpcoes.length) {
      setFaltaQuartos(true);
      setErro('Escolha quantos quartos você procura.');
      document.getElementById('avise-quartos')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setEnviando(true);
    try {
      const res = await registrarInteresse({
        developmentId,
        propertyId,
        condominio: condominio || 'Anúncio',
        nome: f.nome,
        email: f.email,
        telefone: f.telefone,
        finalidade: f.finalidade,
        areaMin: n(f.areaMin),
        areaMax: n(f.areaMax),
        valorMax: n(f.valorMax),
        mensagem: f.mensagem,
        raio: f.raio,
        quartosOpcoes: f.quartosOpcoes,
        aceitaContato: true
      });
      if (res.ok) setOk(true);
      else setErro(res.erro ?? 'Não foi possível registrar agora.');
    } catch {
      setErro('Não foi possível registrar agora. Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  if (ok) {
    return (
      <section id="avise-me" className="mt-10 scroll-mt-28 rounded-2xl border border-emerald-300 bg-emerald-50 p-6">
        <h2 className="text-xl font-bold text-emerald-900">Pronto, você será avisado!</h2>
        <p className="mt-1 text-sm text-emerald-900">Assim que surgir um imóvel {alcance} dentro do que você procura, avisamos você. Um corretor também pode entrar em contato.</p>
      </section>
    );
  }

  return (
    <section id="avise-me" className={`mt-10 scroll-mt-28 rounded-2xl border p-5 md:p-6 ${destaque ? 'border-accent/60 bg-[#f5f8ff]' : 'border-[var(--border)]'}`}>
      <h2 className="text-xl font-bold">{noAnuncio ? 'Quer ser avisado de imóveis como este?' : `Quer um imóvel no ${condominio}?`}</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {noAnuncio ? 'Quando entrar algo parecido, aqui ou perto, eu aviso você.' : 'Diga o que procura que eu aviso quando surgir algo aqui ou perto.'}
      </p>

      <form onSubmit={enviar} className="mt-4 flex flex-col gap-3">
        {cliente && (
          <div className="flex items-center gap-2 rounded-xl bg-[#EEF5FF] px-3 py-2 text-[13px]">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[12px] font-bold text-white">{(cliente.nome || cliente.email).slice(0, 1).toUpperCase()}</span>
            Preenchido pela sua conta Google
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            Seu nome
            <input className={inputClass} value={f.nome} onChange={(e) => set('nome', e.target.value)} required autoComplete="name" />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            E-mail
            <input className={inputClass} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          WhatsApp
          <input
            className={`${inputClass} ${cliente && !f.telefone ? 'border-2 border-accent' : ''}`}
            placeholder="(62) 9 0000-0000"
            inputMode="tel"
            autoComplete="tel"
            value={maskTelefone(f.telefone)}
            onChange={(e) => set('telefone', e.target.value.replace(/\D/g, ''))}
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[12.5px] font-semibold">Me avise de imóveis</legend>
          <div className="flex flex-wrap gap-2">
            {opcoes.map(([v, t]) => (
              <button
                key={v}
                type="button"
                aria-pressed={f.raio === v}
                onClick={() => set('raio', v)}
                className={`h-10 flex-1 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ${f.raio === v ? 'border-2 border-accent bg-[#EEF5FF] text-accent' : 'border border-[var(--border)]'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset id="avise-quartos" className={`flex flex-col gap-1.5 ${faltaQuartos && !f.quartosOpcoes.length ? 'rounded-xl bg-red-50 p-2 ring-2 ring-red-400' : ''}`}>
          <legend className="mb-1.5 text-[12.5px] font-semibold">
            Quartos <span className="text-red-600">*</span> <span className="font-normal text-[var(--text-muted)]">(marque um ou mais; 0 para sala ou lote)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {NUMEROS_FILTRO.map((q) => (
              <button
                key={q}
                type="button"
                aria-pressed={f.quartosOpcoes.includes(q)}
                onClick={() => {
                  set('quartosOpcoes', alternarNumero(f.quartosOpcoes, q));
                  setFaltaQuartos(false);
                  setErro(null);
                }}
                className={`h-10 min-w-[48px] flex-1 rounded-full px-3 text-[14px] font-semibold ${f.quartosOpcoes.includes(q) ? 'border-2 border-accent bg-[#EEF5FF] text-accent' : 'border border-[var(--border)]'}`}
              >
                {rotuloNumero(q)}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="button" onClick={() => setDetalhes((d) => !d)} className="self-start text-[13px] font-semibold text-accent hover:underline">
          {detalhes ? 'Esconder detalhes' : 'Detalhar o que procuro (opcional)'}
        </button>
        {detalhes && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-2 sm:col-span-2">
              {(['venda', 'aluguel'] as const).map((fin) => (
                <button
                  key={fin}
                  type="button"
                  onClick={() => set('finalidade', fin)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${f.finalidade === fin ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
                >
                  {fin === 'venda' ? 'Quero comprar' : 'Quero alugar'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="Metragem de (m²)" inputMode="numeric" value={f.areaMin} onChange={(e) => set('areaMin', e.target.value.replace(/\D/g, ''))} />
              <input className={inputClass} placeholder="até (m²)" inputMode="numeric" value={f.areaMax} onChange={(e) => set('areaMax', e.target.value.replace(/\D/g, ''))} />
            </div>
            <input
              className={inputClass}
              placeholder={f.finalidade === 'aluguel' ? 'Aluguel até (R$/mês)' : 'Quanto pretende investir (até)'}
              inputMode="numeric"
              value={maskCurrencyInput(f.valorMax)}
              onChange={(e) => set('valorMax', e.target.value.replace(/\D/g, ''))}
            />
            <textarea
              className={`${inputClass} h-auto resize-none py-2.5 sm:col-span-2`}
              rows={2}
              placeholder="Algo mais? (andar, posição do sol, vaga extra...)"
              value={f.mensagem}
              onChange={(e) => set('mensagem', e.target.value)}
            />
          </div>
        )}

        {erro && <p className="text-sm font-semibold text-red-600">{erro}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" disabled={enviando} className="h-12 flex-1 rounded-full bg-ink px-5 text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-50">
            {enviando ? 'Enviando…' : 'Quero ser avisado'}
          </button>
          {whats && (
            <div className="flex-1 [&>*]:w-full">
              <BotaoWhatsapp ctx={whats} variante="bloco" rotulo="Prefiro falar agora no WhatsApp" />
            </div>
          )}
        </div>
        <p className="text-center text-[11.5px] text-[var(--text-muted)]">
          Você recebe só imóveis dentro do que escolheu, por e-mail ou por WhatsApp. Sai quando quiser.{' '}
          <a href="/termos" className="underline">
            Termos de uso
          </a>
          .
        </p>
      </form>
    </section>
  );
}

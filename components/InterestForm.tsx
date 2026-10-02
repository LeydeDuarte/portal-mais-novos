'use client';

// "Avise-me": registro de interesse do condomínio e do anúncio.
//  - logado com o Google: nome e e-mail já vêm preenchidos, só falta o WhatsApp;
//  - a pessoa escolhe o alcance: só neste condomínio, até 500 m ou até 2 km. É o
//    consentimento registrado (LGPD): recebe só o que está dentro do que escolheu;
//  - vira lead em Painel → Interessados (com o alcance) e, quando um imóvel entra
//    dentro do alcance, a pessoa recebe e-mail (lib/actions.ts, avisarInteressados).
import { useEffect, useMemo, useState } from 'react';
import { registrarInteresse } from '@/lib/actions';
import { maskCurrencyInput } from '@/lib/currency';
import { useSession } from '@/lib/use-session';
import BotaoWhatsapp, { type WhatsappContexto } from '@/components/BotaoWhatsapp';
import { NUMEROS_FILTRO, alternarNumero, rotuloNumero } from '@/lib/filters';
import type { TipoUnidade } from '@/lib/tipologias';
import {
  FAIXAS_AREA,
  GRUPO_DO_TIPO,
  GRUPO_LABEL,
  RAIO_BAIRRO,
  RAIO_CONDOMINIO,
  RAIO_MUNICIPIO,
  grupoUsaQuartos,
  opcoesDeAlcance,
  type GrupoInteresse
} from '@/lib/interesse-regras';

const ORDEM_GRUPOS: GrupoInteresse[] = ['apartamento', 'casa', 'comercial', 'lote', 'rural'];

type Props = {
  developmentId?: string;
  /** nome do condomínio (ou vazio, em anúncio sem condomínio) */
  condominio: string;
  /** true quando o condomínio não tem nenhum anúncio (quadro em evidência) */
  destaque?: boolean;
  /** formulário na página de um anúncio */
  propertyId?: string;
  whats?: WhatsappContexto;
  /** tipos de imóvel do condomínio ou do anúncio: decidem a pergunta (quartos ou tamanho) e o alcance */
  tipos?: string[];
  tipoCondominio?: 'vertical' | 'horizontal';
  bairro?: string;
  cidade?: string;
};

const inputClass = 'h-12 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-[15px] outline-none focus:border-accent';

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

export default function InterestForm({ developmentId, condominio, destaque, propertyId, whats, tipos, tipoCondominio, bairro, cidade }: Props) {
  const { session } = useSession();
  const cliente = session.cliente;
  const temCondominio = !!condominio;
  const noAnuncio = !!propertyId;
  // o que dá para procurar aqui (apartamento, casa, comercial, lote, rural)
  const grupos = useMemo(() => {
    const g = new Set<GrupoInteresse>();
    for (const t of tipos ?? []) {
      const x = GRUPO_DO_TIPO[t as TipoUnidade];
      if (x) g.add(x);
    }
    if (!g.size) g.add(tipoCondominio === 'horizontal' ? 'casa' : 'apartamento');
    return ORDEM_GRUPOS.filter((x) => g.has(x));
  }, [tipos, tipoCondominio]);
  const refAlcance = { condominio: temCondominio ? condominio : null, bairro: bairro ?? null, cidade: cidade ?? null };
  const raioInicial = (g: GrupoInteresse) => {
    const ops = opcoesDeAlcance(g, refAlcance);
    // no anúncio, começa em 500 m (ou no município, se rural); no condomínio, "Só no condomínio"
    return g === 'rural' ? ops[0][0] : noAnuncio ? 500 : ops[0][0];
  };
  const [f, setF] = useState({
    nome: '',
    telefone: '',
    email: '',
    grupo: grupos[0],
    raio: raioInicial(grupos[0]),
    faixa: null as number | null,
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

  const usaQuartos = grupoUsaQuartos(f.grupo);
  const faixas = usaQuartos ? [] : FAIXAS_AREA[f.grupo as 'comercial' | 'lote' | 'rural'];
  const opcoes = opcoesDeAlcance(f.grupo, refAlcance);
  const ref = temCondominio ? ` do ${condominio}` : ' daqui';
  const alcance =
    f.raio === RAIO_CONDOMINIO
      ? `no ${condominio}`
      : f.raio === RAIO_BAIRRO
        ? `no ${bairro ?? 'bairro'}`
        : f.raio === RAIO_MUNICIPIO
          ? `em ${cidade ?? 'no município'}`
          : f.raio >= 1000
            ? `a até ${(f.raio / 1000).toLocaleString('pt-BR')} km${ref}`
            : `a até ${f.raio} m${ref}`;
  const trocarGrupo = (g: GrupoInteresse) => setF((p) => ({ ...p, grupo: g, raio: raioInicial(g), faixa: null, quartosOpcoes: [], areaMin: '', areaMax: '' }));

  const [faltaQuartos, setFaltaQuartos] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    // obrigatório: quartos (apartamento e casa) ou tamanho (comercial, lote, rural)
    if (usaQuartos ? !f.quartosOpcoes.length : f.faixa == null) {
      setFaltaQuartos(true);
      setErro(usaQuartos ? 'Escolha quantos quartos você procura.' : 'Escolha o tamanho que você procura.');
      document.getElementById('avise-quartos')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const faixaSel = !usaQuartos && f.faixa != null ? faixas[f.faixa] : null;
    setEnviando(true);
    try {
      const res = await registrarInteresse({
        developmentId,
        propertyId,
        condominio,
        nome: f.nome,
        email: f.email,
        telefone: f.telefone,
        finalidade: f.finalidade,
        areaMin: faixaSel ? faixaSel.min ?? undefined : n(f.areaMin),
        areaMax: faixaSel ? faixaSel.max ?? undefined : n(f.areaMax),
        grupo: f.grupo,
        valorMax: n(f.valorMax),
        mensagem: f.mensagem,
        raio: f.raio,
        quartosOpcoes: usaQuartos ? f.quartosOpcoes : [],
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

        {grupos.length > 1 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[12.5px] font-semibold">Procuro</legend>
            <div className="flex flex-wrap gap-2">
              {grupos.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={f.grupo === g}
                  onClick={() => trocarGrupo(g)}
                  className={`h-10 flex-1 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ${f.grupo === g ? 'border-2 border-accent bg-[#EEF5FF] text-accent' : 'border border-[var(--border)]'}`}
                >
                  {GRUPO_LABEL[g]}
                </button>
              ))}
            </div>
          </fieldset>
        )}

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

        <fieldset
          id="avise-quartos"
          className={`flex flex-col gap-1.5 ${faltaQuartos && (usaQuartos ? !f.quartosOpcoes.length : f.faixa == null) ? 'rounded-xl bg-red-50 p-2 ring-2 ring-red-400' : ''}`}
        >
          <legend className="mb-1.5 text-[12.5px] font-semibold">
            {usaQuartos ? 'Quartos' : f.grupo === 'rural' ? 'Área' : 'Tamanho'} <span className="text-red-600">*</span>{' '}
            {usaQuartos && <span className="font-normal text-[var(--text-muted)]">(marque um ou mais)</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {usaQuartos
              ? NUMEROS_FILTRO.map((q) => (
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
                ))
              : faixas.map((fx, i) => (
                  <button
                    key={fx.rotulo}
                    type="button"
                    aria-pressed={f.faixa === i}
                    onClick={() => {
                      set('faixa', i);
                      setFaltaQuartos(false);
                      setErro(null);
                    }}
                    className={`h-10 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold ${f.faixa === i ? 'border-2 border-accent bg-[#EEF5FF] text-accent' : 'border border-[var(--border)]'}`}
                  >
                    {fx.rotulo}
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
            {usaQuartos && (
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="Metragem de (m²)" inputMode="numeric" value={f.areaMin} onChange={(e) => set('areaMin', e.target.value.replace(/\D/g, ''))} />
              <input className={inputClass} placeholder="até (m²)" inputMode="numeric" value={f.areaMax} onChange={(e) => set('areaMax', e.target.value.replace(/\D/g, ''))} />
            </div>
            )}
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

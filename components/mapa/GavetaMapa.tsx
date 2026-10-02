'use client';

// Gaveta do mapa público (direita no computador, de baixo no celular).
// Abas: Unidades (ou Detalhes, no anúncio) · ☀ Sol · Avise-me. Botão verde sempre fixo.
import { useCallback, useEffect, useState } from 'react';
import BotaoWhatsapp from '@/components/BotaoWhatsapp';
import InterestForm from '@/components/InterestForm';
import PosicaoSol from '@/components/PosicaoSol';
import { getBadgeCondominio, getStatusBucket, temEntrega } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { precoCurto, type PontoCondominio, type PontoImovel } from '@/lib/mapa-tipos';
import { SITE_URL } from '@/lib/seo';
import IconeOlhoCortado from '@/components/IconeOlhoCortado';

export type CondoComImoveis = PontoCondominio & { imoveis: PontoImovel[] };
export type Selecionado = { tipo: 'condominio'; c: CondoComImoveis } | { tipo: 'imovel'; i: PontoImovel };

const brl = (n: number | null) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'Consulte');
const tipoTxt = (t: string | null) => (t ? TIPO_UNIDADE_LABEL[t as TipoUnidade] ?? 'Imóvel' : 'Imóvel');
const det = (i: { quartos: number | null; vagas: number | null; area: number | null }) =>
  [i.quartos ? `${i.quartos} qto${i.quartos > 1 ? 's' : ''}` : '', i.vagas ? `${i.vagas} vaga${i.vagas > 1 ? 's' : ''}` : '', i.area ? `${Math.round(i.area)} m²` : '']
    .filter(Boolean)
    .join(' · ');

/** bolinha de quem anunciou: foto, selo do WhatsApp e primeiro nome; abre o WhatsApp com o link do anúncio */
function Anunciante({ i }: { i: PontoImovel }) {
  const a = i.anunciante;
  if (!a) return null;
  const msg = `Olá, ${a.nome}! Vi este anúncio no Mais Novos Imóveis e quero saber mais: ${SITE_URL}${i.url}`;
  return (
    <a
      href={`https://wa.me/${a.whatsapp}?text=${encodeURIComponent(msg)}`}
      target="_blank"
      rel="noopener"
      data-rastro="whatsapp"
      data-rastro-ref={i.id}
      aria-label={`Falar com ${a.nome} no WhatsApp sobre este anúncio`}
      className="flex w-[54px] shrink-0 flex-col items-center gap-0.5"
    >
      <span className="relative h-11 w-11">
        {a.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.foto} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-[#25D366]" loading="lazy" />
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-[16px] font-bold text-accent ring-2 ring-[#25D366]">{a.nome.slice(0, 1).toUpperCase()}</span>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-[#25D366] ring-2 ring-[var(--bg)]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" aria-hidden>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.4Z" />
          </svg>
        </span>
      </span>
      <span className="max-w-full truncate text-[10.5px] font-semibold text-[var(--text-muted)]">{a.nome}</span>
    </a>
  );
}

export type SolNoMapa = { lat: number; lng: number; dia: 'hoje' | 'inverno' | 'verao'; minutos: number } | null;

export default function GavetaMapa({ sel, onFechar, onSol }: { sel: Selecionado; onFechar: () => void; onSol?: (v: SolNoMapa) => void }) {
  const condo = sel.tipo === 'condominio' ? sel.c : null;
  const imovel = sel.tipo === 'imovel' ? sel.i : null;
  const fase = condo && temEntrega(condo.entrega) ? getStatusBucket(condo.entrega) : null;
  const semNada = !!condo && !condo.imoveis.length && !condo.preco && !(fase && ['breve_lancamento', 'lancamento', 'obras'].includes(fase));
  // lançamento, obras ou pronto há até 36 meses, sem unidade listada: "em cadastramento"
  const mesesDesdeEntrega = condo?.entrega
    ? (() => {
        const [y, m] = condo.entrega.split('-').map(Number);
        const agora = new Date();
        return (agora.getFullYear() - y) * 12 + (agora.getMonth() + 1 - m);
      })()
    : null;
  const emCadastramento =
    !!condo && !condo.imoveis.length && !!fase && (['breve_lancamento', 'lancamento', 'obras'].includes(fase) || (mesesDesdeEntrega != null && mesesDesdeEntrega <= 36));
  const abaInicial = semNada && !emCadastramento ? 'aviso' : 'principal';
  const [aba, setAba] = useState<'principal' | 'sol' | 'aviso'>(abaInicial);
  useEffect(() => setAba(abaInicial), [sel, abaInicial]);

  const pLat = condo ? condo.lat : imovel!.lat;
  const pLng = condo ? condo.lng : imovel!.lng;
  // aba Sol aberta (e liberada): o mapa grande desenha o caminho do sol em volta do prédio
  const mudarSol = useCallback(
    (v: { dia: 'hoje' | 'inverno' | 'verao'; minutos: number } | null) => onSol?.(v ? { lat: pLat, lng: pLng, ...v } : null),
    [onSol, pLat, pLng]
  );
  const nome = condo ? condo.nome : imovel!.nome;
  const capa = condo ? condo.capa : imovel!.capa;
  const url = condo ? condo.url : imovel!.url;
  const bairro = condo ? condo.bairro : imovel!.bairro;
  const cidade = condo ? condo.cidade : imovel!.cidade;
  const whats = {
    titulo: `${nome}${bairro ? `, ${bairro}` : ''}`,
    caminho: url,
    condominio: condo ? condo.nome : undefined,
    developmentId: condo ? condo.id : imovel!.condominioId ?? undefined
  };
  const badge = condo ? getBadgeCondominio(condo.entrega, condo.horizontal ? 'horizontal' : 'vertical') : null;
  const etiqueta = imovel?.vendidoEm
    ? { t: `Vendido em ${imovel.vendidoEm.split('-').reverse().join('/')}`, cor: '#E62F2F' }
    : imovel?.privado
      ? { t: 'Anúncio privado', cor: '#20242C' }
      : badge?.label
        ? { t: badge.text, cor: badge.bg.startsWith('rgba') ? '#5B6B7A' : badge.bg }
        : null;
  const tabs: [typeof aba, string][] = [
    ['principal', condo ? `Unidades${condo.imoveis.length ? ` (${condo.imoveis.length})` : ''}` : 'Detalhes'],
    ['sol', '☀ Sol'],
    ['aviso', 'Avise-me']
  ];

  return (
    <aside
      aria-label={nome}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-[var(--bg)] shadow-[0_-10px_30px_rgba(0,0,0,0.18)] md:absolute md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:max-h-none md:w-[420px] md:rounded-3xl md:shadow-2xl"
    >
      <div className={`relative shrink-0 bg-[#DDE1E6] transition-[height] ${aba === 'principal' ? 'h-28 md:h-36' : 'h-20 md:h-24'}`}>
        {capa && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capa} alt={`${nome}, ${[bairro, cidade].filter(Boolean).join(', ')}`} className="h-full w-full object-cover" />
        )}
        {etiqueta && (
          <span className="absolute left-3 top-3 rounded-md px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white" style={{ background: etiqueta.cor }}>
            {etiqueta.t}
          </span>
        )}
        <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-xl text-white">
          ×
        </button>
      </div>

      <div className="shrink-0 px-5 pt-3">
        <h2 className="text-[19px] font-bold leading-tight">{nome}</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">
          {[bairro, cidade].filter(Boolean).join(', ')}
          {condo && condo.empresas.length > 0 && (
            <>
              {' · '}
              {condo.empresas.length > 1 ? 'Construtoras: ' : 'Construtora: '}
              {condo.empresas.map((e, k) => (
                <span key={e.nome}>
                  {k > 0 && ' · '}
                  {e.slug ? (
                    <a href={`/empresa/${e.slug}`} target="_blank" rel="noopener" className="font-semibold text-accent hover:underline">
                      {e.nome}
                    </a>
                  ) : (
                    <b>{e.nome}</b>
                  )}
                </span>
              ))}
            </>
          )}
        </p>
        {(condo?.preco || imovel?.preco) && (
          <p className="mt-1.5 flex items-baseline gap-2">
            {condo && <span className="text-[12px] text-[var(--text-muted)]">A partir de</span>}
            <span className="text-[20px] font-bold tabular-nums">{brl((condo ? condo.preco : imovel!.preco) ?? null)}</span>
          </p>
        )}
        <div role="tablist" className="mt-3 flex gap-1 border-b border-[var(--border)]">
          {tabs.map(([v, t]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={aba === v}
              onClick={() => setAba(v)}
              className={`h-10 px-3 text-[13.5px] ${aba === v ? `border-b-[3px] font-bold ${v === 'sol' ? 'border-[#F59E0B]' : 'border-accent'}` : 'font-semibold text-[var(--text-muted)]'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4">
        {aba === 'principal' && condo && (
          <div className="mt-3 flex flex-col gap-2">
            {condo.horizontal && condo.imoveis.length > 0 && (
              <p className="rounded-xl bg-[var(--pill-bg)] px-3 py-2 text-[12.5px]">Por segurança dos proprietários, a localização de cada casa é informada na visita.</p>
            )}
            {condo.imoveis.length === 0 ? (
              <p className="rounded-xl bg-[var(--pill-bg)] px-3 py-2.5 text-[13.5px]">
                {emCadastramento ? (
                  <>
                    <b>Condomínio em cadastramento.</b> Fale com o consultor.
                  </>
                ) : semNada ? (
                  'Nenhuma unidade anunciada agora.'
                ) : (
                  'Unidades direto com a construtora: fale com o consultor para ver preços e disponibilidade.'
                )}
              </p>
            ) : (
              [...condo.imoveis]
                .sort((a, b) => Number(a.privado) - Number(b.privado) || (a.preco ?? 1e13) - (b.preco ?? 1e13))
                .map((i) => (
                <div key={i.id} className="flex items-center gap-2 rounded-2xl border border-[var(--border)] p-2">
                  <a href={i.url} target="_blank" rel="noopener" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl hover:bg-[var(--pill-bg)]">
                    {i.privado ? (
                      <span className="flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-[#1d2026] text-white">
                        <IconeOlhoCortado size={18} strokeWidth={1.8} />
                        <span className="text-[7.5px] font-extrabold uppercase tracking-[0.12em]">Privado</span>
                      </span>
                    ) : (
                      <span className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-[#DDE1E6]">
                        {i.capa && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.capa} alt="" className="h-full w-full object-cover" loading="lazy" />
                        )}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      {i.privado && <span className="block text-[10.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Anúncio privado</span>}
                      <span className="block text-[14px] font-bold tabular-nums">{brl(i.preco)}</span>
                      <span className="block truncate text-[12px] text-[var(--text-muted)]">{[tipoTxt(i.tipoUnidade), det(i)].filter(Boolean).join(' · ')}</span>
                    </span>
                  </a>
                  <Anunciante i={i} />
                </div>
              ))
            )}
          </div>
        )}
        {aba === 'principal' && imovel && (
          <div className="mt-3 flex flex-col gap-2 text-[14px]">
            <div className="flex items-center justify-between gap-3">
              <p>{[tipoTxt(imovel.tipoUnidade), det(imovel)].filter(Boolean).join(' · ')}</p>
              {!imovel.vendidoEm && <Anunciante i={imovel} />}
            </div>
            {imovel.aproximada && <p className="text-[12.5px] text-[var(--text-muted)]">Localização aproximada: o círculo mostra a região. O endereço é informado na visita.</p>}
            {imovel.privado && <p className="text-[12.5px] text-[var(--text-muted)]">Anúncio reservado a pedido do proprietário. Fale com a gente para ver fotos, valor e disponibilidade.</p>}
            {imovel.vendidoEm && <p className="text-[12.5px] text-[var(--text-muted)]">Este imóvel foi vendido. Fale com o corretor: temos opções parecidas na região.</p>}
          </div>
        )}
        {aba === 'sol' && (
          <PosicaoSol
            lat={condo ? condo.lat : imovel!.lat}
            lng={condo ? condo.lng : imovel!.lng}
            nome={nome}
            whats={whats}
            aproximado={!!imovel?.aproximada}
            compacto
            onMudar={mudarSol}
          />
        )}
        {aba === 'aviso' && (
          <InterestForm
            key={`${sel.tipo}:${condo ? condo.id : imovel!.id}`}
            developmentId={condo ? condo.id : imovel!.condominioId ?? undefined}
            propertyId={imovel && !imovel.privado ? imovel.id : undefined}
            condominio={condo ? condo.nome : ''}
            tipos={condo ? condo.imoveis.map((i) => i.tipoUnidade ?? '').filter(Boolean) : [imovel!.tipoUnidade ?? ''].filter(Boolean)}
            tipoCondominio={condo?.horizontal ? 'horizontal' : 'vertical'}
            bairro={bairro ?? undefined}
            cidade={cidade ?? undefined}
          />
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-[var(--border)] px-5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">
        <div className="flex-1 [&>*]:w-full">
          <BotaoWhatsapp ctx={whats} variante="bloco" rotulo={imovel?.vendidoEm ? 'Falar com o corretor' : condo && !condo.imoveis.length ? 'Preços e disponibilidade c/ consultor' : 'Fale comigo'} />
        </div>
        {!imovel?.privado && (
          <a href={url} target="_blank" rel="noopener" className="flex h-[46px] shrink-0 items-center rounded-full border border-[var(--border)] px-4 text-[13.5px] font-semibold hover:bg-[var(--pill-bg)]">
            Ver página
          </a>
        )}
      </div>
    </aside>
  );
}

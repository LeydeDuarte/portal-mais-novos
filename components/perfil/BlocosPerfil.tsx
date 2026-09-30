// Blocos do perfil do imóvel e do condomínio (layout novo, set/2026):
// título → galeria (vídeo em autoplay como capa) → coluna do preço (preço, chips de
// entrega/metragens logo ABAIXO do preço, tipologias, sobre com "ler mais") e coluna
// da região (mapa + números do bairro + contato) → privados primeiro → à venda no
// condomínio → no bairro → similares. Barra fixa no rodapé: Salvar + Fale comigo.
import Link from 'next/link';
import type { ReactNode } from 'react';
import LocationCard from '@/components/LocationCard';
import OcultoCard from '@/components/OcultoCard';
import DetailFavoriteButton from '@/components/DetailFavoriteButton';
import BotaoCompartilhar from '@/components/BotaoCompartilhar';
import BotaoWhatsapp, { type WhatsappContexto } from '@/components/BotaoWhatsapp';
import type { AnuncioOculto, DevelopmentCardData, MercadoDoBairro } from '@/lib/actions';
import DevelopmentCard from '@/components/DevelopmentCard';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

/** "Entrega mai/2026" (futuro) · "Entregue em mai/2019" (passado) · null (sem data) */
export function textoEntrega(deliveryDate?: string | null): string | null {
  if (!deliveryDate || !/^\d{4}-\d{2}/.test(deliveryDate)) return null;
  const [a, m] = deliveryDate.split('-').map(Number);
  const rotulo = `${MESES[m - 1]}/${a}`;
  const futuro = new Date(a, m - 1, 28) > new Date();
  return futuro ? `Entrega ${rotulo}` : `Entregue em ${rotulo}`;
}

// ---------- título ----------
export function TituloPerfil({ titulo, subtitulo, endereco, extra, acoes }: { titulo: string; subtitulo?: string | null; endereco?: string | null; extra?: ReactNode; acoes?: ReactNode }) {
  return (
    <header className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-serif text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]">{titulo}</h1>
        {/* favoritar e compartilhar: ao lado do nome, acima das fotos */}
        {acoes && <div className="flex shrink-0 items-center gap-2 pt-0.5">{acoes}</div>}
      </div>
      {subtitulo && <p className="mt-1 text-[15px] font-semibold text-[var(--text-muted)]">{subtitulo}</p>}
      {extra && <div className="mt-2">{extra}</div>}
      {endereco && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#257CFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {endereco}
        </p>
      )}
    </header>
  );
}

// ---------- caixa do preço (com os números do bairro à direita) ----------
export function CaixaPreco({
  rotulo,
  preco,
  apoio,
  mercado
}: {
  rotulo: string; // "Valores a partir de" / "Valor de venda"
  preco: string | null; // já formatado; null = sob consulta
  apoio?: string | null; // ex.: "Média de R$ 11.200/m² na tabela"
  mercado?: MercadoDoBairro | null;
}) {
  const temMercado = !!mercado && (!!mercado.m2Anunciado || mercado.vendidos12m > 0);
  return (
    <div className="flex flex-col justify-between gap-4 rounded-[20px] border border-black/[0.05] bg-[#F6F6F7] p-5 md:flex-row md:items-center md:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{rotulo}</p>
        <p className="mt-1.5 font-sans text-[30px] font-bold leading-none tracking-tight tabular-nums md:text-[34px]">{preco ?? 'Sob consulta'}</p>
        {apoio && <p className="mt-2 text-[13px] text-[var(--text-muted)]">{apoio}</p>}
      </div>
      {temMercado && (
        // espaço da VALORIZAÇÃO: hoje mostra os números reais do bairro (anúncios e vendas registradas)
        <div className="flex items-center gap-3 md:max-w-[46%] md:text-right">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/5 bg-white md:order-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#257CFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </span>
          <div>
            {mercado!.m2Anunciado ? (
              <p className="text-[15px] font-bold leading-tight">
                {brl(mercado!.m2Anunciado)}/m² <span className="font-semibold text-[var(--text-muted)]">média no {mercado!.bairro}</span>
              </p>
            ) : null}
            <p className="text-[12px] text-[var(--text-muted)]">
              {[
                mercado!.anuncios ? `${mercado!.anuncios} à venda no bairro` : null,
                mercado!.vendidos12m ? `${mercado!.vendidos12m} vendido(s) em 12 meses${mercado!.m2Vendido ? ` a ${brl(mercado!.m2Vendido)}/m²` : ''}` : null
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- chips (entrega, fase, metragens) logo abaixo do preço ----------
export type Chip = { texto: string; tipo?: 'entrega' | 'fase' | 'neutro'; bg?: string; cor?: string };
export function ChipsPerfil({ chips }: { chips: Chip[] }) {
  const lista = chips.filter((c) => c.texto);
  if (!lista.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {lista.map((c, i) =>
        c.tipo === 'entrega' ? (
          <span key={i} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13px] font-bold text-white">
            {c.texto}
          </span>
        ) : c.tipo === 'fase' ? (
          <span key={i} className="inline-flex h-9 items-center rounded-full px-4 text-[12px] font-bold uppercase tracking-wide" style={{ background: c.bg, color: c.cor }}>
            {c.texto}
          </span>
        ) : (
          <span key={i} className="inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-[13px] font-bold">
            {c.texto}
          </span>
        )
      )}
    </div>
  );
}

// ---------- título de seção ----------
export function SecaoPerfil({ titulo, subtitulo, icone, children, id }: { titulo: string; subtitulo?: string | null; icone?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="flex items-center gap-2 font-serif text-[21px] font-semibold tracking-tight md:text-[23px]">
        {icone}
        {titulo}
      </h2>
      {subtitulo && <p className="mt-1 text-[13px] text-[var(--text-muted)]">{subtitulo}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const Cadeado = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]" aria-hidden>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// ---------- anúncios privados (vêm ANTES dos anunciados: valorizam o site) ----------
export function SecaoPrivados({ onde, itens, perto = false }: { onde: string; itens: AnuncioOculto[]; perto?: boolean }) {
  if (!itens.length) return null;
  return (
    <SecaoPerfil titulo={perto ? `Anúncios privados perto ${onde}` : `Anúncios privados no ${onde}`} subtitulo="Imóveis da nossa carteira que não estão públicos a pedido do proprietário. Peça para ver e verificamos a disponibilidade." icone={<Cadeado />}>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {itens.map((a) => (
          <OcultoCard key={a.id} a={a} />
        ))}
      </div>
    </SecaoPerfil>
  );
}

// ---------- cartão da região (coluna direita) ----------
export function CardRegiao({
  titulo,
  subtitulo,
  mapsQuery,
  aproximado,
  numeros
}: {
  titulo: string;
  subtitulo: string;
  mapsQuery: string;
  aproximado?: boolean;
  numeros: { valor: string | null; rotulo: string }[];
}) {
  const lista = numeros.filter((n) => n.valor);
  return (
    <div className="overflow-hidden rounded-[20px] border border-black/[0.08] bg-[var(--bg)]">
      <div className="flex items-center gap-2 p-4 text-[15px] font-bold">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#257CFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4" />
        </svg>
        Localização
      </div>
      <LocationCard embutido title={titulo} subtitle={subtitulo} mapsQuery={mapsQuery} approximate={aproximado} />
      {lista.length > 0 && (
        <div className={`grid gap-2 p-4 text-center ${lista.length >= 3 ? 'grid-cols-3' : lista.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {lista.map((n) => (
            <div key={n.rotulo} className="rounded-[12px] bg-[#F6F6F7] p-2.5">
              <p className="font-sans text-[15px] font-bold tabular-nums leading-tight">{n.valor}</p>
              <p className="mt-0.5 text-[10.5px] leading-tight text-[var(--text-muted)]">{n.rotulo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- barra fixa do rodapé: Salvar + Fale comigo ----------
export function BarraContatoFixa({ favoritoId, whats, rotulo, compartilhar }: { favoritoId?: string | null; whats?: WhatsappContexto | null; rotulo?: string; compartilhar?: { url: string; titulo: string; refId?: string } }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-black/[0.08] bg-[var(--bg)] px-3 pb-[calc(10px+env(safe-area-inset-bottom,0px))] pt-2.5 shadow-[0_-6px_20px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-[560px] gap-2.5">
        {favoritoId && <DetailFavoriteButton propertyId={favoritoId} curto />}
        {compartilhar && <BotaoCompartilhar {...compartilhar} tamanho={52} />}
        {whats ? (
          <BotaoWhatsapp ctx={whats} variante="barra" rotulo={rotulo} />
        ) : (
          <Link href="#fale-conosco" className="flex h-[52px] flex-1 items-center justify-center rounded-full bg-accent text-[15px] font-bold text-white hover:brightness-95">
            {rotulo ?? 'Fale conosco'}
          </Link>
        )}
      </div>
    </div>
  );
}

/** espaço no fim da página para a barra fixa não cobrir o rodapé */
export const EspacoBarra = () => <div className="h-24" aria-hidden />;

// ---------- condomínios em grade (lançamentos próximos, vizinhos) ----------
export function SecaoCondominios({ titulo, subtitulo, itens }: { titulo: string; subtitulo?: string; itens: DevelopmentCardData[] }) {
  if (!itens.length) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {subtitulo && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{subtitulo}</p>}
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4">
        {itens.map((c) => (
          <DevelopmentCard key={c.id} development={c} />
        ))}
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProtecaoTela from '@/components/ProtecaoTela';
import Logo from '@/components/Logo';
import { query } from '@/lib/db';
import { verificarAssinado } from '@/lib/session';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { semTravessoes } from '@/lib/text';

// Resumo do imóvel para OUTRO CORRETOR mandar ao cliente dele: fotos públicas e
// características, SEM contatos da Mais Novos, sem endereço e sem nome do
// condomínio, com a marca d'água do corretor que compartilhou. Não indexa.
export const metadata: Metadata = { title: 'Imóvel', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const brl = (v: unknown) => (v ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);
const tel = (d?: string | null) => {
  const n = (d ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}` : '';
};
// tira telefones, e-mails e links que possam estar na descrição
const limpar = (t: string) =>
  semTravessoes(t)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/(\(?\d{2}\)?\s?)?9?\d{4}[-\s.]?\d{4}/g, '')
    .replace(/creci[^\n]*/gi, '');

export default async function ResumoCorretor({ params }: { params: { token: string } }) {
  const dados = verificarAssinado<{ i: string; e: string }>(decodeURIComponent(params.token));
  if (!dados?.i) notFound();
  const r = await query<Record<string, unknown>>(
    `select p.*, s.name as corretor_nome, s.telefone as corretor_tel from properties p
       left join staff_users s on lower(s.email) = lower($2)
      where p.id = $1 and p.visibilidade = 'publico' and not p.is_tipologia`,
    [dados.i, dados.e]
  ).catch(() => []);
  const p = r[0];
  if (!p) notFound();
  const fotos = (Array.isArray(p.photos) ? p.photos : []) as string[];
  const marca = `${String(p.corretor_nome ?? 'Corretor')}${tel(p.corretor_tel as string) ? ` · ${tel(p.corretor_tel as string)}` : ''}`;
  const tipo = TIPO_UNIDADE_LABEL[p.tipo_unidade as TipoUnidade] ?? String(p.tipo_unidade ?? 'Imóvel');
  const itens = [
    p.area ? `${Number(p.area)} m² privativos` : null,
    p.area_lote ? `Lote de ${Number(p.area_lote)} m²` : null,
    p.quartos ? `${p.quartos} quartos` : null,
    p.banheiros ? `${p.banheiros} banheiros` : null,
    p.vagas ? `${p.vagas} vagas` : null,
    p.valor_condominio ? `Condomínio ${brl(p.valor_condominio)}/mês` : null,
    p.iptu_mensal ? `IPTU ${brl(p.iptu_mensal)}/mês` : null
  ].filter(Boolean);

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 select-none">
      <ProtecaoTela />
      <div className="flex items-center justify-between gap-3">
        <Logo tipo="completo" altura={34} />
        <span className="rounded-full bg-[var(--pill-bg)] px-3 py-1 text-xs font-semibold">Apresentado por {marca}</span>
      </div>
      <h1 className="mt-5 font-serif text-2xl font-semibold">
        {tipo} {p.finalidade === 'aluguel' ? 'para alugar' : 'à venda'}
        {p.bairro ? ` no ${String(p.bairro)}` : ''}
        {p.cidade ? `, ${String(p.cidade)}` : ''}
      </h1>
      <div className="mt-1 text-2xl font-bold">{brl(p.price_value) ?? 'Valor sob consulta'}</div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {itens.map((t) => (
          <span key={t as string} className="rounded-full bg-[var(--pill-bg)] px-3 py-1 font-semibold">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fotos.map((u, k) => (
          <div key={u} className="relative overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Foto ${k + 1}`} draggable={false} className="pointer-events-none aspect-[4/3] w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-8 overflow-hidden">
              {[0, 1, 2].map((n) => (
                <span key={n} className="-rotate-[20deg] whitespace-nowrap text-[15px] font-bold text-white/45 [text-shadow:0_1px_2px_rgba(0,0,0,.35)]">
                  {marca} · {marca}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {typeof p.description === 'string' && p.description.trim() && (
        <div className="mt-6 whitespace-pre-line text-[15px] leading-relaxed">{limpar(p.description)}</div>
      )}
      <p className="mt-8 text-center text-xs text-[var(--text-faint)]">Material de apresentação. Fotos protegidas: não é permitido baixar nem reproduzir.</p>
    </div>
  );
}

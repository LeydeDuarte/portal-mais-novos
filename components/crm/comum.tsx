'use client';

// Peças comuns das telas do CRM.
import Link from 'next/link';
import type { Nota } from '@/lib/crm-tipos';

export const ORIGEM: Record<string, { nome: string; bg: string; tx: string }> = {
  whatsapp: { nome: 'WhatsApp do anúncio', bg: '#E7F9EE', tx: '#0B6B33' },
  'avise-me': { nome: 'Avise-me', bg: '#EAF2FF', tx: '#1A5FD0' },
  avaliador: { nome: 'Avaliador', bg: '#FFF4E5', tx: '#8A4B00' },
  vender: { nome: 'Venda seu imóvel', bg: '#FFF4E5', tx: '#8A4B00' },
  proposta: { nome: 'Proposta', bg: '#F3E8FF', tx: '#6B21A8' },
  formulario: { nome: 'Formulário', bg: '#F2F3F5', tx: '#14161A' },
  jetimob: { nome: 'Jetimob', bg: '#F2F3F5', tx: '#5B6068' },
  corretor: { nome: 'Corretor', bg: '#FDECEC', tx: '#B42318' },
  manual: { nome: 'Cadastro manual', bg: '#F2F3F5', tx: '#14161A' }
};

export function OrigemChip({ origem }: { origem: string | null }) {
  const o = ORIGEM[origem ?? ''] ?? { nome: origem ?? 'Outro', bg: '#F2F3F5', tx: '#14161A' };
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: o.bg, color: o.tx }}>
      {o.nome}
    </span>
  );
}

export function NotaChip({ nota, comMotivo = false }: { nota: Nota; comMotivo?: boolean }) {
  const cor = nota.faixa === 'quente' ? { bg: '#FDECEC', tx: '#B42318' } : nota.faixa === 'morno' ? { bg: '#FFF4E5', tx: '#8A4B00' } : { bg: '#F2F3F5', tx: '#5B6068' };
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ background: cor.bg, color: cor.tx }} title={nota.motivos.join(' · ')}>
      {nota.faixa === 'quente' ? 'Quente' : nota.faixa === 'morno' ? 'Morno' : 'Frio'} · {nota.valor}
      {comMotivo && nota.motivos.length > 0 && <span className="font-medium">: {nota.motivos.slice(0, 3).join(', ')}</span>}
    </span>
  );
}

export function tempoDesde(iso: string | null): string {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

export const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '';

export const brl = (n: number | null) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '');

export function linkWhats(tel: string | null, texto: string): string | null {
  const d = (tel ?? '').replace(/\D/g, '');
  if (d.length < 12) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

export function Iniciais({ nome, tam = 36 }: { nome: string; tam?: number }) {
  const ini = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-[#DDE5F5] font-bold text-[#1A5FD0]" style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.36) }}>
      {ini || '?'}
    </span>
  );
}

const ABAS = [
  { href: '/dashboard/crm', nome: 'Hoje' },
  { href: '/dashboard/crm/funil', nome: 'Funil' },
  { href: '/dashboard/crm/contatos', nome: 'Contatos' },
  { href: '/dashboard/avisos', nome: 'Para avisar' }
];
export function CrmNav({ ativo, gestor }: { ativo: string; gestor: boolean }) {
  const abas = gestor ? [...ABAS, { href: '/dashboard/crm/equipe', nome: 'Equipe e distribuição' }, { href: '/dashboard/crm/ia', nome: 'IA e WhatsApp' }] : ABAS;
  return (
    <nav aria-label="CRM" className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg)] px-5 md:px-8">
      {abas.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`whitespace-nowrap border-b-[3px] px-3 py-3 text-[13.5px] ${a.href === ativo ? 'border-accent font-bold' : 'border-transparent font-semibold text-[var(--text-muted)] hover:text-[var(--text)]'}`}
        >
          {a.nome}
        </Link>
      ))}
    </nav>
  );
}

/** de onde veio: rede ou site, se foi anúncio pago e a campanha */
export function CanalChip({ canal }: { canal: { nome: string | null; pago: boolean; campanha: string | null } }) {
  const nome = canal.nome ?? 'Direto';
  const cor = canal.pago ? { bg: '#14161A', tx: '#FFFFFF' } : { bg: '#FFFFFF', tx: '#14161A' };
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border border-[#C9CDD3] px-2 py-0.5 text-[11.5px] font-semibold"
      style={{ background: cor.bg, color: cor.tx, borderColor: canal.pago ? '#14161A' : '#C9CDD3' }}
      title={canal.campanha ? `Campanha: ${canal.campanha}` : undefined}
    >
      {nome}
      {canal.pago ? ' · anúncio' : ''}
      {canal.campanha && <span className="truncate font-normal opacity-80">· {canal.campanha}</span>}
    </span>
  );
}

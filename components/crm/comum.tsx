'use client';

// Peças comuns das telas do CRM.
import Link from 'next/link';
import type { Nota } from '@/lib/crm-tipos';
import { usePathname, useSearchParams } from 'next/navigation';
import { useStaffSession } from '@/lib/use-staff-session';
import { itemAtivo } from '@/lib/crm-menu';
import { itensVisiveis } from './MolduraCrm';

export const ORIGEM: Record<string, { nome: string; bg: string; tx: string }> = {
  whatsapp: { nome: 'WhatsApp do anúncio', bg: '#E7F9EE', tx: '#0B6B33' },
  proprietario: { nome: 'Proprietário', bg: '#FFF4E5', tx: '#8A4B00' },
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
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-px text-[10.5px] font-medium" style={{ background: o.bg, color: o.tx }}>
      {o.nome}
    </span>
  );
}

export function NotaChip({ nota, comMotivo = false }: { nota: Nota; comMotivo?: boolean }) {
  const cor = nota.faixa === 'quente' ? { bg: '#FDECEC', tx: '#B42318' } : nota.faixa === 'morno' ? { bg: '#FFF4E5', tx: '#8A4B00' } : { bg: '#F2F3F5', tx: '#5B6068' };
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px text-[10.5px] font-medium" style={{ background: cor.bg, color: cor.tx }} title={nota.motivos.join(' · ')}>
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

/** Abas do CRM no celular (no computador, o menu lateral da MolduraCrm faz esse papel). */
export function CrmNav({ ativo: _ativo }: { ativo?: string; gestor?: boolean }) {
  const pathname = usePathname() ?? '';
  const busca = useSearchParams();
  const { staff } = useStaffSession();
  const ativo = itemAtivo(pathname, busca?.get('f') ?? null);
  const itens = itensVisiveis(staff?.role).flatMap((g) => g.itens);
  return (
    <nav aria-label="CRM" className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg)] px-4 [scrollbar-width:none] md:hidden">
      {itens.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`whitespace-nowrap border-b-[3px] px-2.5 py-2.5 text-[13px] ${a.href === ativo ? 'border-accent font-bold' : 'border-transparent font-semibold text-[var(--text-muted)]'}`}
        >
          {a.nome}
          {a.acesso === 'admin' && <span className="text-accent">*</span>}
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
      className="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border border-[#C9CDD3] px-1.5 py-px text-[10.5px] font-medium"
      style={{ background: cor.bg, color: cor.tx, borderColor: canal.pago ? '#14161A' : '#C9CDD3' }}
      title={canal.campanha ? `Campanha: ${canal.campanha}` : undefined}
    >
      {nome}
      {canal.pago ? ' · anúncio' : ''}
      {canal.campanha && <span className="truncate font-normal opacity-80">· {canal.campanha}</span>}
    </span>
  );
}

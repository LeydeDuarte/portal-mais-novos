import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import NoticiaView from '@/components/news/NoticiaView';
import { query } from '@/lib/db';
import { mapNoticia } from '@/lib/news/dados';
import { staffAtual } from '@/lib/staff-auth';

// Prévia de rascunho/agendada: só a equipe logada vê. Fora do Google.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Prévia da notícia', robots: { index: false, follow: false } };

export default async function PreviaNoticia({ params }: { params: { id: string } }) {
  const staff = await staffAtual().catch(() => null);
  if (!staff) redirect('/dashboard/login');
  const rows = await query<Record<string, unknown>>('select * from noticias where id = $1', [params.id]);
  if (!rows[0]) notFound();
  const n = mapNoticia(rows[0]);
  return <NoticiaView n={n} previa={n.status !== 'publicada'} />;
}

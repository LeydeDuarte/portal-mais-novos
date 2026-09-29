'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import PhotoUploadField from '@/components/PhotoUploadField';
import CorretorSelo from '@/components/CorretorSelo';
import { TituloPainel, campoPainel } from '@/components/painel/ui';
import { useStaffSession } from '@/lib/use-staff-session';
import { lerMeuPerfil, salvarMeuPerfil, type MeuPerfil } from '@/lib/actions-perfil';

const rotulo = 'mb-1 block text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]';

// Meu perfil: o que aparece no site junto dos anúncios (foto, nome e CRECI) e o
// WhatsApp da marca d'água dos links para corretor.
export default function MeuPerfilPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [p, setP] = useState<MeuPerfil | null>(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff) lerMeuPerfil().then(setP).catch(() => {});
  }, [staff]);
  if (!loaded || !staff || !p) return <PainelNav />;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const r = await salvarMeuPerfil({ ...p, senhaAtual, novaSenha }).catch(() => ({ ok: false, erro: 'Não foi possível salvar.' }));
    setSalvando(false);
    setMsg(r.ok ? { ok: true, t: 'Perfil salvo.' } : { ok: false, t: r.erro ?? 'Não foi possível salvar.' });
    if (r.ok) {
      setSenhaAtual('');
      setNovaSenha('');
    }
  };

  return (
    <div className="min-h-screen">
      <PainelNav />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 md:px-6">
        <TituloPainel titulo="Meu perfil" contagem={p.email} />
        <form onSubmit={salvar} className="mt-6 grid gap-8 md:grid-cols-[1fr_260px]">
          <div className="flex flex-col gap-5">
            <PhotoUploadField
              photos={p.foto ? [p.foto] : []}
              onChange={(u) => setP({ ...p, foto: u[u.length - 1] ?? null })}
              onUploadingChange={setEnviando}
              folder="site"
              label="Foto de perfil (aparece na bolinha dos anúncios)"
              compacto
              nomeArquivo={`corretor ${p.nomePublico || p.nome}`}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={rotulo}>Nome no site</span>
                <input className={campoPainel} value={p.nomePublico} onChange={(e) => setP({ ...p, nomePublico: e.target.value })} placeholder={p.nome} maxLength={80} />
              </label>
              <label>
                <span className={rotulo}>CRECI</span>
                <input className={campoPainel} value={p.creci} onChange={(e) => setP({ ...p, creci: e.target.value })} placeholder="Ex.: 12345-F" maxLength={30} />
              </label>
              <label className="sm:col-span-2">
                <span className={rotulo}>WhatsApp</span>
                <input className={campoPainel} inputMode="tel" value={p.telefone} onChange={(e) => setP({ ...p, telefone: e.target.value })} placeholder="(62) 9 9999-9999" />
              </label>
              <label className="sm:col-span-2">
                <span className={rotulo}>Apresentação ({p.bio.length}/1500)</span>
                <textarea
                  className={`${campoPainel} min-h-[110px]`}
                  value={p.bio}
                  maxLength={1500}
                  onChange={(e) => setP({ ...p, bio: e.target.value })}
                  placeholder="Especialidades, regiões onde atua, anos de mercado…"
                />
              </label>
            </div>
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <div className="mb-3 text-sm font-bold">Trocar senha (opcional)</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="password" autoComplete="current-password" className={campoPainel} value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} placeholder="Senha atual" />
                <input type="password" autoComplete="new-password" className={campoPainel} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Nova senha (mín. 8)" />
              </div>
            </div>
            {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}
            <button disabled={enviando || salvando} className="h-11 w-fit rounded-full bg-ink px-6 text-[14px] font-semibold text-white disabled:opacity-60">
              {salvando ? 'Salvando…' : 'Salvar perfil'}
            </button>
          </div>
          <div>
            <span className={rotulo}>Como aparece nos anúncios</span>
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <CorretorSelo c={{ nome: p.nomePublico || p.nome, foto: p.foto, creci: p.creci || null }} grande />
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--border)] p-4">
              <CorretorSelo c={{ nome: p.nomePublico || p.nome, foto: p.foto, creci: p.creci || null }} />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

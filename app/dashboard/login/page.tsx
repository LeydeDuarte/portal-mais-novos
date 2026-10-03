'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import SolNascente from '@/components/painel/SolNascente';
import FraseDoDia from '@/components/painel/FraseDoDia';
import { useStaffSession } from '@/lib/use-staff-session';
import { CORES_DO_CEU, SAUDACAO_DA_FASE, faseDoDia, fraseDoDia, type FaseDoDia } from '@/lib/frases';
import { SITE_URL } from '@/lib/seo';

const campo =
  'h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 text-[15px] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20';

// Login da equipe: o céu com o sol nascendo e a frase do dia de um lado,
// o formulário do outro (no celular, o céu fica em cima).
export default function PainelLoginPage() {
  const { login } = useStaffSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);
  // frase diferente da que aparece no painel no mesmo dia
  const frase = fraseDoDia(29);
  const [fase, setFase] = useState<FaseDoDia>(() => faseDoDia());
  useEffect(() => {
    // ?ceu=noite (ou manha, tarde, entardecer) só para conferir as cenas
    const f = new URLSearchParams(window.location.search).get('ceu');
    if (f && f in CORES_DO_CEU) setFase(f as FaseDoDia);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Preencha o e-mail e a senha.');
      return;
    }
    setEntrando(true);
    const user = await login(email.trim(), password).catch(() => null);
    if (user === 'bloqueado') {
      setEntrando(false);
      setError('Muitas tentativas erradas. Por segurança, o acesso ficou bloqueado por 15 minutos.');
      return;
    }
    if (!user) {
      setEntrando(false);
      setError('E-mail ou senha incorretos.');
      return;
    }
    router.push('/dashboard');
  };

  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(0,1.1fr)_minmax(380px,1fr)]">
      {/* Céu: marca, frase do dia e o sol */}
      <section className="relative flex flex-col overflow-hidden bg-[var(--ceu)] px-6 pt-6 transition-colors md:px-12 md:pt-10" style={CORES_DO_CEU[fase] as React.CSSProperties}>
        <a href={SITE_URL} aria-label="Ir para o site Mais Novos Imóveis" className="self-start">
          <Logo tipo="completo" altura={36} cor={fase === 'noite' ? 'branco' : 'auto'} />
        </a>
        <div className="mt-8 md:mt-auto md:pb-6">
          <FraseDoDia frase={frase} grande />
        </div>
        <div className="mt-6 flex justify-center md:mt-10 md:justify-start">
          <SolNascente fase={fase} className="h-auto w-[230px] md:w-[min(100%,440px)]" />
        </div>
      </section>

      {/* Formulário */}
      <main className="flex items-center justify-center px-6 py-10 md:px-12">
        <div className="w-full max-w-[380px]">
          <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-tight md:text-[32px]" suppressHydrationWarning>
            {SAUDACAO_DA_FASE[fase]}! Que bom ter você aqui.
          </h1>
          <p className="mt-2 text-[15px] text-[var(--text-muted)]">Entre com o e-mail e a senha da equipe Mais Novos.</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">E-mail</span>
              <input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Senha</span>
              <span className="relative">
                <input
                  type={verSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${campo} pr-20`}
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-accent hover:bg-[var(--pill-bg)]"
                >
                  {verSenha ? 'Esconder' : 'Mostrar'}
                </button>
              </span>
            </label>
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={entrando}
              className="mt-2 h-12 rounded-full bg-accent px-5 text-[15px] font-bold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {entrando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-[13px] text-[var(--text-muted)]">Esqueceu a senha? Peça ao administrador para trocar em Painel, Equipe.</p>
          <a href={SITE_URL} className="mt-8 inline-block text-[13px] font-semibold text-[var(--text-muted)] hover:text-accent">
            Voltar para o site
          </a>
        </div>
      </main>
    </div>
  );
}

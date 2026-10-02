'use client';

// CRM · IA e WhatsApp (só admin): liga a IA, modo teste, parâmetros da simulação e instruções.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { CrmNav } from '@/components/crm/comum';
import { useStaffSession } from '@/lib/use-staff-session';
import { lerConfiguracaoIA, salvarConfiguracaoIA } from '@/lib/actions-crm';
import type { ConfigIA } from '@/lib/crm-config';

const campo = 'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-accent';

export default function CrmIaPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [d, setD] = useState<Awaited<ReturnType<typeof lerConfiguracaoIA>> | null>(null);
  const [c, setC] = useState<ConfigIA | null>(null);
  const [numeros, setNumeros] = useState('');
  const [bancos, setBancos] = useState<{ nome: string; taxa: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (loaded && (!staff || staff.role !== 'admin')) router.replace(staff ? '/dashboard/crm' : '/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff?.role !== 'admin') return;
    lerConfiguracaoIA().then((r) => {
      setD(r);
      setC(r.config);
      setNumeros(r.config.numerosTeste.join('\n'));
      setBancos(Object.entries(r.config.taxasBancos).map(([nome, taxa]) => ({ nome, taxa: String(taxa) })));
    });
  }, [staff]);
  if (!loaded || staff?.role !== 'admin') return null;

  const salvar = async () => {
    if (!c) return;
    setMsg(null);
    try {
      await salvarConfiguracaoIA({
        ...c,
        numerosTeste: numeros.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean),
        taxasBancos: Object.fromEntries(bancos.filter((b) => b.nome.trim() && Number(b.taxa.replace(',', '.')) > 0).map((b) => [b.nome.trim(), Number(b.taxa.replace(',', '.'))]))
      });
      setMsg('Salvo.');
      const r = await lerConfiguracaoIA();
      setD(r);
      setC(r.config);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };

  const Item = ({ ok, t, sub }: { ok: boolean; t: string; sub: string }) => (
    <li className="flex items-start gap-2.5 py-1.5">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${ok ? 'bg-[#13874B]' : 'bg-[#C2410C]'}`}>{ok ? '✓' : '!'}</span>
      <span>
        <b className="text-[13.5px]">{t}</b>
        <span className="block text-[12px] text-[var(--text-muted)]">{sub}</span>
      </span>
    </li>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <CrmNav ativo="/dashboard/crm/ia" gestor />
      <main className="mx-auto w-full max-w-3xl px-5 py-6 md:px-8">
        <h1 className="text-2xl font-bold">IA e WhatsApp</h1>
        <p className="text-sm text-[var(--text-muted)]">A IA responde no WhatsApp da empresa com os dados do portal, manda a simulação e passa para a equipe quando precisa.</p>
        {!d || !c ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <>
            <section className="mt-5 rounded-2xl border border-[var(--border)] p-4">
              <h2 className="text-[15px] font-bold">Ligações</h2>
              <ul className="mt-1">
                <Item ok={d.status.whatsapp} t="WhatsApp (token e número)" sub="WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID na Vercel" />
                <Item ok={d.status.assinatura} t="Chave secreta do app" sub="WHATSAPP_APP_SECRET: confere que as mensagens vêm da Meta" />
                <Item ok={d.status.verificacao} t="Token de verificação do webhook" sub="WHATSAPP_VERIFY_TOKEN: o mesmo que vai na Meta, em WhatsApp → Configuração" />
                <Item ok={d.status.ia} t="Chave da IA" sub={`ANTHROPIC_API_KEY · modelo ${d.status.modelo}`} />
              </ul>
              <p className="mt-2 text-[12px] text-[var(--text-muted)]">Endereço do webhook (para a Meta): https://maisnovosimoveis.com/api/whatsapp/webhook · marque o campo messages.</p>
            </section>

            <section className="mt-4 rounded-2xl border border-[var(--border)] p-4">
              <label className="flex items-center gap-3 text-[15px] font-bold">
                <input type="checkbox" checked={c.ligada} onChange={(e) => setC({ ...c, ligada: e.target.checked })} className="h-5 w-5 accent-[#257CFF]" />
                IA ligada
              </label>
              <label className="mt-3 flex items-center gap-3 text-sm font-semibold">
                <input type="checkbox" checked={c.modoTeste} onChange={(e) => setC({ ...c, modoTeste: e.target.checked })} className="h-4 w-4 accent-[#257CFF]" />
                Modo teste: a IA só responde aos números abaixo
              </label>
              <textarea value={numeros} onChange={(e) => setNumeros(e.target.value)} rows={3} placeholder="Um número por linha, com DDD: 62999817077" className={`${campo} mt-2 h-auto py-2`} />
              <label className="mt-3 block text-[12.5px] font-semibold text-[var(--text-muted)]">
                Nome da assistente
                <input value={c.nomeAssistente} onChange={(e) => setC({ ...c, nomeAssistente: e.target.value })} className={`${campo} mt-1`} />
              </label>
            </section>

            <section className="mt-4 rounded-2xl border border-[var(--border)] p-4">
              <h2 className="text-[15px] font-bold">Simulação de financiamento</h2>
              <p className="text-[12px] text-[var(--text-muted)]">Usada na primeira resposta (média dos bancos) e quando o cliente diz o banco (taxa de balcão). Sem a taxa média, a IA não manda números.</p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                <label className="text-[12.5px] font-semibold text-[var(--text-muted)]">
                  Taxa média (% ao ano)
                  <input inputMode="decimal" value={c.taxaMediaAa ?? ''} onChange={(e) => setC({ ...c, taxaMediaAa: Number(e.target.value.replace(',', '.')) || null })} className={`${campo} mt-1`} />
                </label>
                <label className="text-[12.5px] font-semibold text-[var(--text-muted)]">
                  Entrada (%)
                  <input inputMode="numeric" value={c.entradaPct} onChange={(e) => setC({ ...c, entradaPct: Number(e.target.value) || 20 })} className={`${campo} mt-1`} />
                </label>
                <label className="text-[12.5px] font-semibold text-[var(--text-muted)]">
                  Prazo (meses)
                  <input inputMode="numeric" value={c.prazoMeses} onChange={(e) => setC({ ...c, prazoMeses: Number(e.target.value) || 420 })} className={`${campo} mt-1`} />
                </label>
              </div>
              <h3 className="mt-4 text-[13px] font-bold">Taxa de balcão por banco (% ao ano)</h3>
              {bancos.map((b, i) => (
                <div key={i} className="mt-2 flex gap-2">
                  <input value={b.nome} onChange={(e) => setBancos(bancos.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))} placeholder="Banco" className={campo} />
                  <input value={b.taxa} onChange={(e) => setBancos(bancos.map((x, k) => (k === i ? { ...x, taxa: e.target.value } : x)))} placeholder="11,49" inputMode="decimal" className={`${campo} w-32`} />
                  <button type="button" onClick={() => setBancos(bancos.filter((_, k) => k !== i))} aria-label="Remover" className="h-11 w-11 shrink-0 rounded-xl border border-[var(--border)]">
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setBancos([...bancos, { nome: '', taxa: '' }])} className="mt-2 text-[13px] font-semibold text-accent">
                + Banco
              </button>
              <label className="mt-4 block text-[12.5px] font-semibold text-[var(--text-muted)]">
                Bancos credenciados (a IA cita na conversa)
                <input value={c.bancos} onChange={(e) => setC({ ...c, bancos: e.target.value })} className={`${campo} mt-1`} />
              </label>
            </section>

            <section className="mt-4 rounded-2xl border border-[var(--border)] p-4">
              <h2 className="text-[15px] font-bold">Instruções extras para a IA</h2>
              <textarea
                value={c.instrucoesExtras}
                onChange={(e) => setC({ ...c, instrucoesExtras: e.target.value })}
                rows={5}
                placeholder="Ex.: horário de atendimento da equipe, como falar de permuta, promoções da semana…"
                className={`${campo} mt-2 h-auto py-2`}
              />
            </section>

            <div className="mt-5 flex items-center gap-3">
              <button type="button" onClick={salvar} className="h-11 rounded-full bg-accent px-6 text-sm font-bold text-white">
                Salvar
              </button>
              {msg && <span className="text-sm font-semibold">{msg}</span>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
